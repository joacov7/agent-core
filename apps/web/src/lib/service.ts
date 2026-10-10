import type {
  AgentManifest, AgenteConfig, AgenteConfigInput, AutonomyMode, BusinessModel,
  CoreStore, ProviderRegistry, TenantCtx,
} from "@agent-core/contracts";
import {
  capacidadesDeProviders, manifestsActivables, runSeleccion,
  type CapacidadesApp, type RunSeleccionResult,
} from "@agent-core/core";
import { catalogo } from "@agent-core/agents";

/**
 * Capa de servicio del SaaS, agnóstica del framework (no sabe de Next ni de HTTP):
 * es lo que las rutas de API invocan. Combina el catálogo, la activación por
 * capacidades/cadencia y la config por tenant del `CoreStore`. Testeable sola.
 */
export interface ServicioDeps {
  store: CoreStore;
  providers: ProviderRegistry;
  modeloNegocio?: BusinessModel;
}

/** Vista de un agente para la consola: su manifest + si está disponible y su config. */
export interface AgenteVista {
  manifest: AgentManifest;
  /** Activable: la app cubre sus capacidades + la cadencia es compatible. */
  disponible: boolean;
  encendido: boolean;
  autonomia: AutonomyMode;
  plan?: string;
}

export interface Servicio {
  listarAgentes(ctx: TenantCtx): Promise<AgenteVista[]>;
  setAgente(ctx: TenantCtx, cfg: AgenteConfigInput): Promise<AgenteConfig>;
  correr(ctx: TenantCtx): Promise<RunSeleccionResult>;
}

export function crearServicio(deps: ServicioDeps): Servicio {
  const { store, providers, modeloNegocio } = deps;
  const app: CapacidadesApp = modeloNegocio
    ? { capacidades: capacidadesDeProviders(providers), modeloNegocio }
    : { capacidades: capacidadesDeProviders(providers) };

  return {
    async listarAgentes(ctx) {
      const activables = new Set(manifestsActivables(catalogo, app).map((a) => a.manifest.id));
      const configs = store.agentConfig ? await store.agentConfig.list(ctx) : [];
      const porId = new Map(configs.map((c) => [c.agentId, c]));
      return catalogo.map((a) => {
        const cfg = porId.get(a.manifest.id);
        const vista: AgenteVista = {
          manifest: a.manifest,
          disponible: activables.has(a.manifest.id),
          encendido: cfg?.encendido ?? false,
          autonomia: cfg?.autonomia ?? a.manifest.autonomiaMaxima,
        };
        if (cfg?.plan !== undefined) vista.plan = cfg.plan;
        return vista;
      });
    },

    async setAgente(ctx, cfg) {
      if (!store.agentConfig) throw new Error("El CoreStore no persiste agentConfig.");
      return store.agentConfig.set(ctx, cfg);
    },

    async correr(ctx) {
      return runSeleccion({
        catalogo, ctx, providers, store,
        ...(modeloNegocio ? { modeloNegocio } : {}),
      });
    },
  };
}
