import type { ID } from "../common.js";
import type { TenantCtx } from "../tenant.js";
import type { ListQuery, Page } from "./query.js";
import type { Recomendacion } from "../canonical/recomendacion.js";
import type { ResultadoAccion } from "../canonical/ciclo.js";
import type { EntradaMemoria } from "../canonical/memoria.js";

/**
 * Almacén de las tablas PROPIAS del Core (recommendations, action_results,
 * memory_entries). Es el "cliente de datos" que el Core recibe por inversión de
 * dependencia (en vez de importar Prisma).
 *
 * Primera barrera de aislamiento (sección 8): TODA query filtra por `ctx.tenantId`.
 * La implementación de esta interfaz es responsable de no devolver filas de otro
 * tenant; los tests verifican esa propiedad.
 */
export interface RecommendationStore {
  save(ctx: TenantCtx, reco: Recomendacion): Promise<Recomendacion>;
  get(ctx: TenantCtx, id: ID): Promise<Recomendacion | null>;
  list(ctx: TenantCtx, query?: ListQuery): Promise<Page<Recomendacion>>;
}

export interface ActionResultStore {
  save(ctx: TenantCtx, resultado: ResultadoAccion): Promise<ResultadoAccion>;
  list(ctx: TenantCtx, query?: ListQuery): Promise<Page<ResultadoAccion>>;
}

export interface MemoryStore {
  put(ctx: TenantCtx, entrada: EntradaMemoria): Promise<EntradaMemoria>;
  get(ctx: TenantCtx, namespace: string, clave: string): Promise<EntradaMemoria | null>;
  list(ctx: TenantCtx, query?: ListQuery): Promise<Page<EntradaMemoria>>;
}

export interface CoreStore {
  recommendations: RecommendationStore;
  actionResults: ActionResultStore;
  memory: MemoryStore;
}
