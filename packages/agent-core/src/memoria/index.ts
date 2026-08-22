import type { CoreStore, TenantCtx, EntradaMemoria } from "@agent-core/contracts";

/**
 * Memoria estructurada (motor). STUB.
 * Migra `memoria-estructurada.logic.ts`: namespaces, vigencia y decisiones
 * bloqueantes (un "rechazo" vigente veta una acción sobre una entidad).
 */
export function recordar(
  store: CoreStore, ctx: TenantCtx, entrada: EntradaMemoria,
): Promise<EntradaMemoria> {
  return store.memory.put(ctx, entrada);
}
