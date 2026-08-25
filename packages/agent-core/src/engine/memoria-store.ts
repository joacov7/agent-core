import type {
  CoreStore, DecisionValue, EntradaMemoria, EntradaMemoriaNueva, TenantCtx,
} from "@agent-core/contracts";
import { claveDecision } from "../memoria/index.js";
import { relojPorDefecto, generarIdPorDefecto, type Reloj, type GenerarId } from "./ids.js";

/**
 * Write de memoria — el paso que cierra el bucle. Persiste en `memory_entries` vía
 * CoreStore, asignando id/tenant/timestamps. Lo que se guarda acá (decisiones de
 * rechazo/preferencia) es lo que el enforcement lee después (`evaluarEscritura`).
 */
export interface MemoriaDeps { now?: Reloj; generarId?: GenerarId }

export function registrarEntradaMemoria(
  store: CoreStore, ctx: TenantCtx, entrada: EntradaMemoriaNueva, deps?: MemoriaDeps,
): Promise<EntradaMemoria> {
  if (!ctx?.tenantId) {
    throw new Error("TenantCtx obligatorio: el Core no escribe memoria sin tenant (falla cerrado).");
  }
  const now = deps?.now ?? relojPorDefecto;
  const genId = deps?.generarId ?? generarIdPorDefecto;
  return store.memory.put(ctx, {
    ...entrada,
    id: genId(),
    tenantId: ctx.tenantId,
    creadoEn: now().toISOString(),
  });
}

/**
 * Registra una decisión del usuario (rechazo/preferencia) en el namespace
 * "decision", con clave estable por entidad+acción para upsert/dedup.
 */
export function registrarDecision(
  store: CoreStore,
  ctx: TenantCtx,
  kind: "rechazo" | "preferencia",
  value: DecisionValue,
  deps?: MemoriaDeps,
): Promise<EntradaMemoria> {
  const clave = claveDecision(value.entityType, value.entityId, value.accion ?? null);
  return registrarEntradaMemoria(
    store, ctx,
    { namespace: "decision", clave, kind, contenido: value as unknown as Record<string, unknown> },
    deps,
  );
}
