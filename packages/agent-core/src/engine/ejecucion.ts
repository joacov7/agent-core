import type {
  CoreStore, ResultadoAccion, TenantCtx, WriteToolHandler,
} from "@agent-core/contracts";
import type { EnforcementDecision } from "./enforcement.js";
import { relojPorDefecto, generarIdPorDefecto, type Reloj, type GenerarId } from "./ids.js";

/**
 * Ejecuta una acción (tool de escritura) — el paso Acción → Resultado del bucle.
 * NO decide por sí sola: recibe una `EnforcementDecision` ya evaluada y solo
 * ejecuta si está permitida y no requiere aprobación. Persiste el ResultadoAccion.
 */
export interface EjecutarAccionInput {
  ctx: TenantCtx;
  store: CoreStore;
  handler: WriteToolHandler;
  params: Record<string, unknown>;
  decision: EnforcementDecision;
  /** Recomendación que origina la acción (para trazar el bucle). */
  recomendacionId?: string;
  deps?: { now?: Reloj; generarId?: GenerarId };
}

export type EstadoEjecucion =
  | "bloqueada" | "pendiente_aprobacion" | "ejecutada" | "fallida";

export interface EjecucionResultado {
  estado: EstadoEjecucion;
  motivo?: string;
  /** Resultado persistido (solo cuando se ejecutó, con éxito o error). */
  resultado?: ResultadoAccion;
}

export async function ejecutarAccion(input: EjecutarAccionInput): Promise<EjecucionResultado> {
  if (!input.ctx?.tenantId) {
    throw new Error("TenantCtx obligatorio: el Core no ejecuta acciones sin tenant (falla cerrado).");
  }

  const { decision } = input;
  if (!decision.permitido) {
    return decision.motivo === undefined
      ? { estado: "bloqueada" }
      : { estado: "bloqueada", motivo: decision.motivo };
  }
  if (decision.requiereAprobacion) {
    return decision.motivo === undefined
      ? { estado: "pendiente_aprobacion" }
      : { estado: "pendiente_aprobacion", motivo: decision.motivo };
  }

  const now = input.deps?.now ?? relojPorDefecto;
  const genId = input.deps?.generarId ?? generarIdPorDefecto;
  const accionId = genId();

  try {
    const salida = await input.handler.ejecutar(input.ctx, input.params);
    const resultado = await input.store.actionResults.save(input.ctx, {
      id: genId(),
      tenantId: input.ctx.tenantId,
      creadoEn: now().toISOString(),
      accionId,
      ok: true,
      tipo: "ejecutada",
      salida: { retorno: salida },
    });
    return { estado: "ejecutada", resultado };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    const resultado = await input.store.actionResults.save(input.ctx, {
      id: genId(),
      tenantId: input.ctx.tenantId,
      creadoEn: now().toISOString(),
      accionId,
      ok: false,
      tipo: "error",
      error: mensaje,
    });
    return { estado: "fallida", motivo: mensaje, resultado };
  }
}
