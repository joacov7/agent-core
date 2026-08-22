import type { CoreStore, TenantCtx, ResultadoAccion } from "@agent-core/contracts";

/**
 * Resultados (motor). STUB.
 * Migra `resultados.logic.ts` (clasificación y métricas), separando SIEMPRE el
 * valor REAL medido del estimado. Enlaza el bucle Acción → Resultado → Impacto.
 */
export function registrarResultado(
  store: CoreStore, ctx: TenantCtx, resultado: ResultadoAccion,
): Promise<ResultadoAccion> {
  return store.actionResults.save(ctx, resultado);
}
