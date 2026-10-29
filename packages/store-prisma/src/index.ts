import type {
  AgenteConfig, CoreStore, EntradaMemoria, GastoIA, Impacto, Recomendacion,
  ResultadoAccion, TenantCtx,
} from "@agent-core/contracts";
import type { FilaConData, FilaGasto, PrismaLike } from "./prisma-like.js";

export type { PrismaLike, FilaConData, FilaGasto } from "./prisma-like.js";

// El objeto canónico completo viaja en la columna `data`; las columnas escalares son
// solo para indexar/consultar/aislar. Toda query filtra por `ctx.tenantId`.
const dato = <T>(fila: FilaConData): T => fila.data as T;
const fecha = (iso: string): Date => new Date(iso);

/**
 * Implementa el `CoreStore` del Core sobre Postgres vía Prisma. Mismo contrato que
 * el store in-memory de las apps; pasa los mismos tests de comportamiento.
 * El parámetro es un `PrismaClient` (satisface `PrismaLike` estructuralmente).
 */
export function crearCoreStorePrisma(db: PrismaLike): CoreStore {
  return {
    recommendations: {
      async save(_ctx: TenantCtx, r: Recomendacion) {
        // Upsert por id (idempotente): el motor refresca las recomendaciones vivas en vez de duplicarlas.
        // `tenantId` y `creadoEn` no se tocan en el update.
        const cols = { agentId: r.agentId, tipo: r.tipo, estado: r.estado, dedupKey: r.dedupKey ?? null, data: r };
        await db.recomendacion.upsert({
          where: { id: r.id },
          create: { id: r.id, tenantId: r.tenantId, creadoEn: fecha(r.creadoEn), ...cols },
          update: cols,
        });
        return r;
      },
      async get(ctx, id) {
        const fila = await db.recomendacion.findFirst({ where: { tenantId: ctx.tenantId, id } });
        return fila ? dato<Recomendacion>(fila) : null;
      },
      async list(ctx) {
        const filas = await db.recomendacion.findMany({ where: { tenantId: ctx.tenantId } });
        return { items: filas.map((f) => dato<Recomendacion>(f)) };
      },
    },

    actionResults: {
      async save(_ctx, res: ResultadoAccion) {
        await db.resultadoAccion.create({
          data: { id: res.id, tenantId: res.tenantId, accionId: res.accionId, creadoEn: fecha(res.creadoEn), data: res },
        });
        return res;
      },
      async list(ctx) {
        const filas = await db.resultadoAccion.findMany({ where: { tenantId: ctx.tenantId } });
        return { items: filas.map((f) => dato<ResultadoAccion>(f)) };
      },
    },

    impacts: {
      async save(_ctx, i: Impacto) {
        await db.impacto.create({
          data: { id: i.id, tenantId: i.tenantId, recomendacionId: i.recomendacionId ?? null, creadoEn: fecha(i.creadoEn), data: i },
        });
        return i;
      },
      async list(ctx) {
        const filas = await db.impacto.findMany({ where: { tenantId: ctx.tenantId } });
        return { items: filas.map((f) => dato<Impacto>(f)) };
      },
      async byRecomendacion(ctx, recomendacionId) {
        const filas = await db.impacto.findMany({ where: { tenantId: ctx.tenantId, recomendacionId } });
        return filas.map((f) => dato<Impacto>(f));
      },
    },

    memory: {
      async put(_ctx, e: EntradaMemoria) {
        await db.entradaMemoria.create({
          data: { id: e.id, tenantId: e.tenantId, namespace: e.namespace, clave: e.clave, creadoEn: fecha(e.creadoEn), data: e },
        });
        return e;
      },
      async get(ctx, namespace, clave) {
        const fila = await db.entradaMemoria.findFirst({ where: { tenantId: ctx.tenantId, namespace, clave } });
        return fila ? dato<EntradaMemoria>(fila) : null;
      },
      async list(ctx) {
        const filas = await db.entradaMemoria.findMany({ where: { tenantId: ctx.tenantId } });
        return { items: filas.map((f) => dato<EntradaMemoria>(f)) };
      },
    },

    gastoIA: {
      async registrar(_ctx, g: GastoIA) {
        await db.gastoIA.create({
          data: { id: g.id, tenantId: g.tenantId, agentId: g.agentId ?? null, costo: g.costo, creadoEn: fecha(g.creadoEn), data: g },
        });
        return g;
      },
      async totalPorTenant(ctx, desde) {
        const filas = await db.gastoIA.findMany({ where: { tenantId: ctx.tenantId } });
        return sumarGasto(filas, desde);
      },
      async totalPorAgente(ctx, agentId, desde) {
        const filas = await db.gastoIA.findMany({ where: { tenantId: ctx.tenantId, agentId } });
        return sumarGasto(filas, desde);
      },
    },

    agentConfig: {
      async list(ctx) {
        const filas = await db.agenteConfig.findMany({ where: { tenantId: ctx.tenantId } });
        return filas.map((f) => dato<AgenteConfig>(f));
      },
      async get(ctx, agentId) {
        const fila = await db.agenteConfig.findFirst({ where: { tenantId: ctx.tenantId, agentId } });
        return fila ? dato<AgenteConfig>(fila) : null;
      },
      async set(ctx, cfg) {
        const full: AgenteConfig = { ...cfg, tenantId: ctx.tenantId, actualizadoEn: new Date().toISOString() };
        const cols = {
          tenantId: ctx.tenantId, agentId: cfg.agentId, encendido: cfg.encendido,
          autonomia: cfg.autonomia, plan: cfg.plan ?? null, actualizadoEn: new Date(), data: full,
        };
        await db.agenteConfig.upsert({
          where: { tenantId_agentId: { tenantId: ctx.tenantId, agentId: cfg.agentId } },
          create: cols,
          update: { encendido: cfg.encendido, autonomia: cfg.autonomia, plan: cfg.plan ?? null, actualizadoEn: new Date(), data: full },
        });
        return full;
      },
    },
  };
}

function sumarGasto(filas: FilaGasto[], desde?: string): number {
  const corte = desde ? Date.parse(desde) : null;
  let total = 0;
  for (const f of filas) {
    if (corte != null) {
      const g = f.data as GastoIA;
      if (Date.parse(g.creadoEn) < corte) continue;
    }
    total += f.costo;
  }
  return total;
}
