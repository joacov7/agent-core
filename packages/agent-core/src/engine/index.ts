import type {
  Agent, AgentContext, AutonomyMode, BusinessModel, CoreStore, ProviderRegistry,
  Recomendacion, TenantCtx,
} from "@agent-core/contracts";
import { esActivable, type CapacidadesApp } from "../activacion/index.js";
import { capacidadesDeProviders } from "./capacidades.js";
import { seleccionDeStore, type PorDefecto } from "./seleccion.js";
import { relojPorDefecto, generarIdPorDefecto, type Reloj, type GenerarId } from "./ids.js";
import { ESTADOS_VIVOS } from "../recommendations/recommendations.logic.js";
import type { EstadoReco } from "@agent-core/contracts";

export * from "./capacidades.js";
export * from "./enforcement.js";
export * from "./ejecucion.js";
export * from "./memoria-store.js";
export * from "./impacto.js";
export * from "./seleccion.js";
export { relojPorDefecto, generarIdPorDefecto } from "./ids.js";
export type { Reloj, GenerarId } from "./ids.js";

/** El agente no es activable en esta app (capacidades faltantes o cadencia incompatible). */
export class AgenteNoActivableError extends Error {
  constructor(
    readonly agentId: string,
    readonly requeridas: readonly string[],
    readonly disponibles: readonly string[],
  ) {
    const faltantes = requeridas.filter((c) => !disponibles.includes(c));
    super(
      `Agente "${agentId}" no activable: faltan capacidades [${faltantes.join(", ") || "—"}] ` +
      `o el modelo de negocio no es compatible. Disponibles: [${disponibles.join(", ") || "—"}].`,
    );
    this.name = "AgenteNoActivableError";
  }
}

export interface RunAgentDeps {
  now?: Reloj;
  generarId?: GenerarId;
}

/**
 * Punto de entrada al Core. Falla cerrado sin TenantCtx (sección 8). Comprueba la
 * activación por manifest (capacidades derivadas de los providers + modelo de
 * negocio), corre el agente y PERSISTE sus recomendaciones (paso Recomendación del
 * bucle), asignándoles id/tenant/timestamps vía CoreStore.
 */
export interface RunAgentInput {
  agent: Agent;
  ctx: TenantCtx;
  providers: ProviderRegistry;
  store: CoreStore;
  config?: Record<string, unknown>;
  /** Modelo de negocio (cadencia) de la app; usado para el gate de activación. */
  modeloNegocio?: BusinessModel;
  deps?: RunAgentDeps;
}

export interface RunAgentResult {
  /** Recomendaciones ya persistidas (con id/tenant/timestamps). */
  recomendaciones: Recomendacion[];
  resumen?: string;
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  if (!input.ctx?.tenantId) {
    throw new Error("TenantCtx obligatorio: el Core no ejecuta sin tenant (falla cerrado).");
  }

  const capacidades = capacidadesDeProviders(input.providers);
  const app: CapacidadesApp = input.modeloNegocio
    ? { capacidades, modeloNegocio: input.modeloNegocio }
    : { capacidades };

  if (!esActivable(input.agent.manifest, app)) {
    throw new AgenteNoActivableError(
      input.agent.manifest.id,
      input.agent.manifest.requiereCapacidades,
      capacidades,
    );
  }

  const context: AgentContext = {
    ctx: input.ctx,
    providers: input.providers,
    store: input.store,
    config: input.config ?? {},
  };
  const salida = await input.agent.run(context);

  const now = input.deps?.now ?? relojPorDefecto;
  const genId = input.deps?.generarId ?? generarIdPorDefecto;

  // Dedup: una sola recomendación VIVA por (agente, dedupKey). Si el agente vuelve a detectar lo
  // mismo, se REFRESCA la existente (mismo id, creadoEn y estado; datos nuevos) en vez de duplicarla.
  // Sin esto cada corrida —manual o programada— duplicaría toda la bandeja.
  const { items: existentes } = await input.store.recommendations.list(input.ctx);
  const vivas = new Map<string, Recomendacion>();
  for (const e of existentes) {
    if (!e.dedupKey || !ESTADOS_VIVOS.includes(e.estado)) continue;
    const k = `${e.agentId}|${e.dedupKey}`;
    const previa = vivas.get(k);
    if (!previa || e.creadoEn > previa.creadoEn) vivas.set(k, e); // si ya había duplicadas, la más nueva
  }

  const recomendaciones: Recomendacion[] = [];
  for (const nueva of salida.recomendaciones) {
    const clave = nueva.dedupKey ? `${nueva.agentId}|${nueva.dedupKey}` : null;
    const previa = clave ? vivas.get(clave) : undefined;
    const persistida = await input.store.recommendations.save(
      input.ctx,
      previa
        ? {
            ...nueva, id: previa.id, tenantId: previa.tenantId, creadoEn: previa.creadoEn,
            estado: previa.estado, actualizadoEn: now().toISOString(),
          }
        : { ...nueva, id: genId(), tenantId: input.ctx.tenantId, creadoEn: now().toISOString() },
    );
    if (clave) vivas.set(clave, persistida);
    recomendaciones.push(persistida);
  }

  // Reconciliación: cada corrida es una FOTO completa de lo que el agente detecta AHORA. Lo que
  // antes estaba abierto y ya no aparece (un cobro que se pagó, una alerta que se resolvió) se
  // EXPIRA: si no, la bandeja y los avisos seguirían reportando condiciones que ya no existen.
  // También limpia duplicados vivos viejos de la misma clave. Solo toca los estados automáticos
  // (new/analyzing/proposed) de ESTE agente: lo que espera una decisión humana (pending_approval,
  // postponed) o ya avanzó (approved, executed…) no se toca. Sin dedupKey no se puede reconciliar.
  const emitidas = new Set(
    salida.recomendaciones.flatMap((r) => (r.dedupKey ? [`${r.agentId}|${r.dedupKey}`] : [])),
  );
  for (const e of existentes) {
    if (e.agentId !== input.agent.manifest.id || !e.dedupKey || !AUTOMATICAS.includes(e.estado)) continue;
    const clave = `${e.agentId}|${e.dedupKey}`;
    const vigente = emitidas.has(clave) && vivas.get(clave)?.id === e.id; // la que quedó refrescada
    if (vigente) continue;
    await input.store.recommendations.save(input.ctx, { ...e, estado: "expired", actualizadoEn: now().toISOString() });
  }

  return salida.resumen === undefined
    ? { recomendaciones }
    : { recomendaciones, resumen: salida.resumen };
}

/** Estados que el motor maneja solo (y por eso puede expirar si la condición desaparece). */
const AUTOMATICAS: EstadoReco[] = ["new", "analyzing", "proposed"];

/**
 * Corre SOLO los agentes encendidos para el tenant (activables ∩ config del store),
 * cada uno con su autonomía efectiva. Es el punto de entrada cuando el deployment
 * persiste la selección por tenant (`CoreStore.agentConfig`); si no la persiste,
 * `pordefecto` decide qué corre (default `"apagado"`).
 */
export interface RunSeleccionInput {
  catalogo: Agent[];
  ctx: TenantCtx;
  providers: ProviderRegistry;
  store: CoreStore;
  modeloNegocio?: BusinessModel;
  /** Qué hacer con un agente disponible sin config guardada (default "apagado"). */
  pordefecto?: PorDefecto;
  /** Config base para agentes sin ajustes propios en su config guardada. */
  config?: Record<string, unknown>;
  deps?: RunAgentDeps;
}

export interface RunSeleccionItem {
  agentId: string;
  /** Autonomía efectiva con la que se lo corrió (acotada al máximo del manifest). */
  autonomia: AutonomyMode;
  plan?: string;
  recomendaciones: Recomendacion[];
  resumen?: string;
}

export interface RunSeleccionResult {
  ejecutados: RunSeleccionItem[];
  /** Todas las recomendaciones persistidas, de todos los agentes encendidos. */
  recomendaciones: Recomendacion[];
}

export async function runSeleccion(input: RunSeleccionInput): Promise<RunSeleccionResult> {
  if (!input.ctx?.tenantId) {
    throw new Error("TenantCtx obligatorio: el Core no ejecuta sin tenant (falla cerrado).");
  }

  const capacidades = capacidadesDeProviders(input.providers);
  const app: CapacidadesApp = input.modeloNegocio
    ? { capacidades, modeloNegocio: input.modeloNegocio }
    : { capacidades };

  const seleccion = await seleccionDeStore(
    input.catalogo, app, input.ctx, input.store,
    input.pordefecto ? { pordefecto: input.pordefecto } : {},
  );

  const ejecutados: RunSeleccionItem[] = [];
  const recomendaciones: Recomendacion[] = [];
  for (const s of seleccion) {
    const r = await runAgent({
      agent: s.agent,
      ctx: input.ctx,
      providers: input.providers,
      store: input.store,
      config: s.config ?? input.config ?? {},
      ...(input.modeloNegocio ? { modeloNegocio: input.modeloNegocio } : {}),
      ...(input.deps ? { deps: input.deps } : {}),
    });
    const item: RunSeleccionItem = {
      agentId: s.agent.manifest.id,
      autonomia: s.autonomia,
      recomendaciones: r.recomendaciones,
    };
    if (s.plan !== undefined) item.plan = s.plan;
    if (r.resumen !== undefined) item.resumen = r.resumen;
    ejecutados.push(item);
    recomendaciones.push(...r.recomendaciones);
  }

  return { ejecutados, recomendaciones };
}
