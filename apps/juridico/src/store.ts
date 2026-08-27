import type {
  CoreStore, EntradaMemoria, GastoIA, GastoStore, Impacto, Recomendacion, ResultadoAccion, TenantCtx,
} from "@agent-core/contracts";

/**
 * CoreStore in-memory (idéntico al de app-ejemplo: las apps son independientes y no
 * dependen entre sí). Toda lectura filtra por `ctx.tenantId` (aislamiento, sección 8).
 */
export interface CoreStoreEnMemoria extends CoreStore {
  gastoIA: GastoStore;
  readonly _recos: Recomendacion[];
  readonly _results: ResultadoAccion[];
  readonly _impacts: Impacto[];
  readonly _mem: EntradaMemoria[];
  readonly _gasto: GastoIA[];
}

export function crearCoreStore(): CoreStoreEnMemoria {
  const recos: Recomendacion[] = [];
  const results: ResultadoAccion[] = [];
  const impacts: Impacto[] = [];
  const mem: EntradaMemoria[] = [];
  const gasto: GastoIA[] = [];
  const delTenant = <T extends { tenantId: string }>(rows: T[], ctx: TenantCtx) =>
    rows.filter((r) => r.tenantId === ctx.tenantId);

  return {
    _recos: recos, _results: results, _impacts: impacts, _mem: mem, _gasto: gasto,
    recommendations: {
      async save(_ctx, r) { recos.push(r); return r; },
      async get(ctx, id) { return delTenant(recos, ctx).find((r) => r.id === id) ?? null; },
      async list(ctx) { return { items: delTenant(recos, ctx) }; },
    },
    actionResults: {
      async save(_ctx, r) { results.push(r); return r; },
      async list(ctx) { return { items: delTenant(results, ctx) }; },
    },
    impacts: {
      async save(_ctx, i) { impacts.push(i); return i; },
      async list(ctx) { return { items: delTenant(impacts, ctx) }; },
      async byRecomendacion(ctx, recomendacionId) {
        return delTenant(impacts, ctx).filter((i) => i.recomendacionId === recomendacionId);
      },
    },
    memory: {
      async put(_ctx, e) { mem.push(e); return e; },
      async get(ctx, namespace, clave) {
        return delTenant(mem, ctx).find((m) => m.namespace === namespace && m.clave === clave) ?? null;
      },
      async list(ctx) { return { items: delTenant(mem, ctx) }; },
    },
    gastoIA: {
      async registrar(_ctx, g) { gasto.push(g); return g; },
      async totalPorTenant(ctx) { return delTenant(gasto, ctx).reduce((s, g) => s + g.costo, 0); },
      async totalPorAgente(ctx, agentId) {
        return delTenant(gasto, ctx).filter((g) => g.agentId === agentId).reduce((s, g) => s + g.costo, 0);
      },
    },
  };
}
