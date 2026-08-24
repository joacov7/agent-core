// ─── Políticas y límites por herramienta (lógica pura, sin DB) ───────────────
// Portado de Regionales casi tal cual. Capa de seguridad ADITIVA sobre la autonomía
// por agente (manual/asistido/autónomo). Permite, por herramienta:
//   • allowed          → habilitar/deshabilitar la tool para el agente
//   • autonomy          → override de autonomía SOLO para esa tool
//   • requires_approval → forzar aprobación aunque el agente sea autónomo
//   • max_change_percent, max_items_per_run, max_daily_actions, allowed_hours
// y límites globales de negocio (margen mínimo, descuento/aumento máx, productos
// y clientes protegidos, horario de WhatsApp, topes diarios).
//
// TODO enforcement se valida en el backend (engine + endpoint de aprobación).
// Nunca se confía en el frontend. Por defecto (sin config) no bloquea nada:
// el comportamiento actual del sistema se mantiene intacto.
//
// PENDIENTE (sección 9 del documento): generalizar `protected_products` /
// `protected_clients` a `protectedEntities: EntityRef[]`. Se deja tal cual por
// ahora para preservar paridad con los tests; el rename es un follow-up acotado.

import type { AutonomyMode } from "@agent-core/contracts";

export interface ToolPolicy {
  allowed?: boolean;
  autonomy?: AutonomyMode | null;
  requires_approval?: boolean;
  max_change_percent?: number | null; // aplicar_precio: |Δ%| máximo
  max_items_per_run?: number | null;  // veces que la tool puede correr por ejecución
  max_daily_actions?: number | null;  // acciones ejecutadas por día (world-facing)
  allowed_hours?: { from: number; to: number } | null; // horario permitido [from,to)
}

export interface GlobalPolicy {
  min_margin_pct?: number | null;
  max_discount_pct?: number | null;
  max_price_increase_pct?: number | null;
  max_whatsapp_daily?: number | null;
  max_price_changes_daily?: number | null;
  protected_products?: string[];
  protected_clients?: string[];
  whatsapp_allowed_hours?: { from: number; to: number } | null;
}

export interface PoliciesConfig {
  global?: GlobalPolicy;
  tools?: Record<string, ToolPolicy>;
  perAgentTool?: Record<string, Record<string, ToolPolicy>>;
}

export const POLICIES_DEFAULT: PoliciesConfig = { global: {}, tools: {}, perAgentTool: {} };

// Resuelve la política efectiva para (agente, tool): perAgentTool > tools >
// default seguro (allowed=true, sin límites → no cambia el comportamiento).
export function resolvePolicy(
  cfg: PoliciesConfig, agentId: string, tool: string
): ToolPolicy {
  const base: ToolPolicy = { allowed: true };
  const t = cfg.tools?.[tool] ?? {};
  const at = cfg.perAgentTool?.[agentId]?.[tool] ?? {};
  return { ...base, ...t, ...at };
}

export interface EvalContext {
  tool: string;
  resolved: ToolPolicy;
  global: GlobalPolicy;
  agentAutonomy: AutonomyMode;
  toolInput: any;
  hora: number;              // 0..23
  ejecutadasEnRun: number;   // veces que ya corrió esta tool en la ejecución
  ejecutadasHoy: number;     // acciones ejecutadas hoy (world-facing) de esta tool
  precioActual?: number | null; // aplicar_precio
  costoActual?: number | null;
}

export interface EvalResult {
  allow: boolean;
  requireApproval: boolean;
  motivo?: string;
}

function enHorario(hora: number, h?: { from: number; to: number } | null): boolean {
  if (!h) return true;
  return hora >= h.from && hora < h.to;
}

// Evalúa una acción de ESCRITURA contra la política. Fail-closed en los bloqueos
// duros; si pasa, indica si requiere aprobación o puede ejecutarse sola.
export function evaluar(c: EvalContext): EvalResult {
  const { resolved: p, global: g, toolInput: inp } = c;

  // 1. Habilitación de la tool.
  if (p.allowed === false) {
    return { allow: false, requireApproval: true, motivo: "herramienta deshabilitada por política" };
  }

  // 2. Entidades protegidas.
  const productId = inp?.productId != null ? String(inp.productId) : null;
  if (productId && (g.protected_products ?? []).includes(productId)) {
    return { allow: false, requireApproval: true, motivo: `producto protegido (${productId})` };
  }
  const cliente = inp?.clientId != null ? String(inp.clientId) : (inp?.to != null ? String(inp.to) : null);
  if (cliente && (g.protected_clients ?? []).includes(cliente)) {
    return { allow: false, requireApproval: true, motivo: `cliente protegido (${cliente})` };
  }

  // 3. Horario permitido (WhatsApp).
  if (c.tool === "enviar_whatsapp") {
    const h = p.allowed_hours ?? g.whatsapp_allowed_hours ?? null;
    if (!enHorario(c.hora, h)) {
      return { allow: false, requireApproval: true, motivo: `fuera del horario permitido (${h?.from}-${h?.to})` };
    }
  }

  // 4. Máximo por ejecución.
  if (p.max_items_per_run != null && c.ejecutadasEnRun >= p.max_items_per_run) {
    return { allow: false, requireApproval: true, motivo: `límite por ejecución alcanzado (${p.max_items_per_run})` };
  }

  // 5. Máximo diario (world-facing).
  const dailyLimit = p.max_daily_actions
    ?? (c.tool === "enviar_whatsapp" ? g.max_whatsapp_daily
      : c.tool === "aplicar_precio" ? g.max_price_changes_daily : null);
  if (dailyLimit != null && c.ejecutadasHoy >= dailyLimit) {
    return { allow: false, requireApproval: true, motivo: `límite diario alcanzado (${dailyLimit})` };
  }

  // 6. Reglas de precio (aplicar_precio).
  if (c.tool === "aplicar_precio" && c.precioActual != null && c.precioActual > 0) {
    const nuevo = Number(inp?.precio);
    if (Number.isFinite(nuevo)) {
      const pct = ((nuevo - c.precioActual) / c.precioActual) * 100;
      if (p.max_change_percent != null && Math.abs(pct) > p.max_change_percent) {
        return { allow: false, requireApproval: true, motivo: `cambio ${pct.toFixed(1)}% supera el máximo ${p.max_change_percent}%` };
      }
      if (pct > 0 && g.max_price_increase_pct != null && pct > g.max_price_increase_pct) {
        return { allow: false, requireApproval: true, motivo: `aumento ${pct.toFixed(1)}% supera el máximo ${g.max_price_increase_pct}%` };
      }
      if (pct < 0 && g.max_discount_pct != null && Math.abs(pct) > g.max_discount_pct) {
        return { allow: false, requireApproval: true, motivo: `descuento ${Math.abs(pct).toFixed(1)}% supera el máximo ${g.max_discount_pct}%` };
      }
      if (c.costoActual != null && c.costoActual > 0 && g.min_margin_pct != null) {
        const margen = ((nuevo - c.costoActual) / nuevo) * 100;
        if (margen < g.min_margin_pct) {
          return { allow: false, requireApproval: true, motivo: `margen ${margen.toFixed(1)}% por debajo del mínimo ${g.min_margin_pct}%` };
        }
      }
    }
  }

  // 7. Autonomía efectiva: la de la tool pisa la del agente; requires_approval
  //    fuerza aprobación. Solo se ejecuta sola si queda 'autonomous'.
  const efectiva: AutonomyMode = p.autonomy ?? c.agentAutonomy;
  const requireApproval = p.requires_approval === true || efectiva !== "autonomous";
  return { allow: true, requireApproval };
}
