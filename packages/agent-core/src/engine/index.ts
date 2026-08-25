import type {
  Agent, AgentContext, BusinessModel, CoreStore, ProviderRegistry,
  Recomendacion, TenantCtx,
} from "@agent-core/contracts";
import { esActivable, type CapacidadesApp } from "../activacion/index.js";
import { capacidadesDeProviders } from "./capacidades.js";
import { relojPorDefecto, generarIdPorDefecto, type Reloj, type GenerarId } from "./ids.js";

export * from "./capacidades.js";
export * from "./enforcement.js";
export * from "./ejecucion.js";
export * from "./memoria-store.js";
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

  const recomendaciones: Recomendacion[] = [];
  for (const nueva of salida.recomendaciones) {
    const persistida = await input.store.recommendations.save(input.ctx, {
      ...nueva,
      id: genId(),
      tenantId: input.ctx.tenantId,
      creadoEn: now().toISOString(),
    });
    recomendaciones.push(persistida);
  }

  return salida.resumen === undefined
    ? { recomendaciones }
    : { recomendaciones, resumen: salida.resumen };
}
