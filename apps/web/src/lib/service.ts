import type {
  AgentManifest, AgenteConfig, AgenteConfigInput, AutonomyMode, BusinessModel,
  CoreStore, ProviderRegistry, Recomendacion, TenantCtx,
} from "@agent-core/contracts";
import {
  capacidadesDeProviders, manifestsActivables, runSeleccion,
  type CapacidadesApp, type RunSeleccionResult,
} from "@agent-core/core";
import { catalogo, personaDe } from "@agent-core/agents";

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

/**
 * Qué está haciendo un agente ahora, para la vista de equipo:
 *  - `no_disponible`: la app no cubre sus capacidades/cadencia.
 *  - `apagado`: disponible pero el tenant no lo encendió.
 *  - `en_espera`: encendido, sin nada pendiente.
 *  - `con_novedades`: encendido, con recomendaciones abiertas.
 *  - `esperando_aprobacion`: encendido, con recomendaciones que esperan tu OK.
 */
export type EstadoAgente = "no_disponible" | "apagado" | "en_espera" | "con_novedades" | "esperando_aprobacion";

/** Cara del agente: nombre propio (alias del tenant o el por defecto) + rol + saludo. */
export interface PersonaVista {
  nombre: string;
  /** El nombre del rol en el catálogo ("Cobros"). */
  rol: string;
  saludo: string;
  /** `true` si el tenant lo renombró. */
  personalizado: boolean;
}

/** Vista de un agente para la consola: su manifest + si está disponible y su config. */
export interface AgenteVista {
  manifest: AgentManifest;
  persona: PersonaVista;
  estado: EstadoAgente;
  /** Recomendaciones abiertas (sin resolver) que generó este agente. */
  novedades: number;
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
  /** Bandeja: las recomendaciones persistidas del tenant, de mayor a menor prioridad. */
  listarRecomendaciones(ctx: TenantCtx): Promise<Recomendacion[]>;
}

/** Recomendaciones ya resueltas: no cuentan como "novedades" del agente. */
const MAX_ALIAS = 40;

/** Input inválido del cliente (la capa HTTP lo traduce a 400, no a 500). */
export class ErrorDeValidacion extends Error {}
const CERRADAS = new Set(["executed", "rejected", "cancelled", "expired", "failed"]);

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
      const { items } = await store.recommendations.list(ctx);
      const abiertas = new Map<string, { total: number; aprobacion: number }>();
      for (const r of items) {
        if (CERRADAS.has(r.estado)) continue;
        const acc = abiertas.get(r.agentId) ?? { total: 0, aprobacion: 0 };
        acc.total += 1;
        if (r.estado === "pending_approval") acc.aprobacion += 1;
        abiertas.set(r.agentId, acc);
      }
      return catalogo.map((a) => {
        const id = a.manifest.id;
        const cfg = porId.get(id);
        const disponible = activables.has(id);
        const encendido = cfg?.encendido ?? false;
        const ab = abiertas.get(id);
        const defecto = personaDe(id);
        const alias = cfg?.alias?.trim();
        const estado: EstadoAgente = !disponible
          ? "no_disponible"
          : !encendido
            ? "apagado"
            : ab && ab.aprobacion > 0
              ? "esperando_aprobacion"
              : ab && ab.total > 0
                ? "con_novedades"
                : "en_espera";
        const vista: AgenteVista = {
          manifest: a.manifest,
          persona: {
            nombre: alias || defecto.nombre,
            rol: a.manifest.nombre,
            saludo: defecto.saludo,
            personalizado: Boolean(alias),
          },
          estado,
          novedades: ab?.total ?? 0,
          disponible,
          encendido,
          autonomia: cfg?.autonomia ?? a.manifest.autonomiaMaxima,
        };
        if (cfg?.plan !== undefined) vista.plan = cfg.plan;
        return vista;
      });
    },

    async setAgente(ctx, cfg) {
      if (!store.agentConfig) throw new Error("El CoreStore no persiste agentConfig.");
      const { alias: aliasIn, ...resto } = cfg;
      // El alias es opcional en el input: si no viene, se conserva el que ya tenía el
      // agente (así la consola puede prender/apagar sin pisar el nombre). `""` lo borra.
      const alias = (aliasIn !== undefined ? aliasIn : (await store.agentConfig.get(ctx, cfg.agentId))?.alias)?.trim();
      if (alias && alias.length > MAX_ALIAS) throw new ErrorDeValidacion(`El nombre no puede superar ${MAX_ALIAS} caracteres.`);
      return store.agentConfig.set(ctx, alias ? { ...resto, alias } : resto);
    },

    async correr(ctx) {
      return runSeleccion({
        catalogo, ctx, providers, store,
        ...(modeloNegocio ? { modeloNegocio } : {}),
      });
    },

    async listarRecomendaciones(ctx) {
      const { items } = await store.recommendations.list(ctx);
      // Ordena por prioridad (1 = máxima) y, a igualdad, por severidad.
      const peso: Record<string, number> = { critica: 0, importante: 1, oportunidad: 2 };
      return [...items].sort(
        (a, b) => a.prioridad - b.prioridad || (peso[a.severidad] ?? 9) - (peso[b.severidad] ?? 9),
      );
    },
  };
}
