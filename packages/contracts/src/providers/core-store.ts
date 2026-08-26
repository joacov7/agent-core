import type { ID, ISODateTime } from "../common.js";
import type { TenantCtx } from "../tenant.js";
import type { ListQuery, Page } from "./query.js";
import type { Recomendacion } from "../canonical/recomendacion.js";
import type { ResultadoAccion, Impacto } from "../canonical/ciclo.js";
import type { EntradaMemoria } from "../canonical/memoria.js";
import type { GastoIA } from "../canonical/gasto.js";

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

/** Impacto medido del bucle (tabla del Core: `impacts`). Cierra Resultado → Impacto. */
export interface ImpactStore {
  save(ctx: TenantCtx, impacto: Impacto): Promise<Impacto>;
  list(ctx: TenantCtx, query?: ListQuery): Promise<Page<Impacto>>;
  byRecomendacion(ctx: TenantCtx, recomendacionId: ID): Promise<Impacto[]>;
}

/**
 * Gasto de IA atribuido por tenant/agente (tabla del Core: `ai_spend`). Lo escribe
 * el AI Gateway; los totales alimentan el enforcement de presupuesto.
 */
export interface GastoStore {
  registrar(ctx: TenantCtx, gasto: GastoIA): Promise<GastoIA>;
  totalPorTenant(ctx: TenantCtx, desde?: ISODateTime): Promise<number>;
  totalPorAgente(ctx: TenantCtx, agentId: string, desde?: ISODateTime): Promise<number>;
}

export interface MemoryStore {
  put(ctx: TenantCtx, entrada: EntradaMemoria): Promise<EntradaMemoria>;
  get(ctx: TenantCtx, namespace: string, clave: string): Promise<EntradaMemoria | null>;
  list(ctx: TenantCtx, query?: ListQuery): Promise<Page<EntradaMemoria>>;
}

export interface CoreStore {
  recommendations: RecommendationStore;
  actionResults: ActionResultStore;
  impacts: ImpactStore;
  memory: MemoryStore;
  /** Opcional: presente solo si el deployment persiste/atribuye gasto de IA. */
  gastoIA?: GastoStore;
}
