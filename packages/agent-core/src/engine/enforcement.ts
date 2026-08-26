import type { AutonomyMode, DecisionValue, EntityRef } from "@agent-core/contracts";
import { evaluar, resolvePolicy, POLICIES_DEFAULT, type PoliciesConfig } from "../policies/index.js";
import { decisionBloqueante } from "../memoria/index.js";
import { relojPorDefecto, type Reloj } from "./ids.js";

/**
 * Enforcement: el Core intercepta TODA tool de escritura antes de ejecutarla
 * (sección 6/7). Combina dos capas:
 *   1) memoria: una decisión de 'rechazo' vigente BLOQUEA la acción (fail-closed).
 *   2) policies: límites, horarios, entidades protegidas, reglas de precio y
 *      autonomía efectiva.
 */
export interface EnforcementInput {
  agentId: string;
  tool: string;
  toolInput: unknown;
  agentAutonomy: AutonomyMode;
  /** Config de políticas del tenant/agente. Default: no bloquea nada. */
  policies?: PoliciesConfig;
  /** Decisiones en memoria que podrían bloquear (namespace "decision"). */
  decisiones?: { kind?: string | null; value: DecisionValue }[];
  /** Entidades que la acción va a tocar (se contrastan contra las protegidas). */
  entidadesAfectadas?: EntityRef[];
  hora?: number;             // 0..23; default: hora del reloj
  ejecutadasEnRun?: number;
  ejecutadasHoy?: number;
  precioActual?: number | null;
  costoActual?: number | null;
  now?: Reloj;
}

export interface EnforcementDecision {
  permitido: boolean;
  requiereAprobacion: boolean;
  motivo?: string;
}

export function evaluarEscritura(input: EnforcementInput): EnforcementDecision {
  const now = input.now ?? relojPorDefecto;

  // 1) Memoria: decisión de rechazo vigente → bloqueo duro.
  const bloqueo = decisionBloqueante(input.decisiones ?? [], input.tool, now());
  if (bloqueo) {
    return {
      permitido: false,
      requiereAprobacion: true,
      motivo: `bloqueado por decisión previa del usuario${bloqueo.motivo ? ` (${bloqueo.motivo})` : ""}`,
    };
  }

  // 2) Policies.
  const cfg = input.policies ?? POLICIES_DEFAULT;
  const resolved = resolvePolicy(cfg, input.agentId, input.tool);
  const ev = evaluar({
    tool: input.tool,
    resolved,
    global: cfg.global ?? {},
    agentAutonomy: input.agentAutonomy,
    toolInput: input.toolInput,
    ...(input.entidadesAfectadas ? { entidadesAfectadas: input.entidadesAfectadas } : {}),
    hora: input.hora ?? now().getHours(),
    ejecutadasEnRun: input.ejecutadasEnRun ?? 0,
    ejecutadasHoy: input.ejecutadasHoy ?? 0,
    precioActual: input.precioActual ?? null,
    costoActual: input.costoActual ?? null,
  });

  return ev.motivo === undefined
    ? { permitido: ev.allow, requiereAprobacion: ev.requireApproval }
    : { permitido: ev.allow, requiereAprobacion: ev.requireApproval, motivo: ev.motivo };
}
