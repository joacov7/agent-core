import type { TenantCtx } from "./tenant.js";
import type { AgentManifest } from "./manifest.js";
import type { ProviderRegistry } from "./providers/registry.js";
import type { CoreStore } from "./providers/core-store.js";
import type { RecomendacionNueva } from "./canonical/recomendacion.js";

/**
 * Contexto que el engine arma y entrega a cada agente en su corrida. El agente lee
 * SOLO capacidades (providers) y su config: no conoce el dominio ni toca la DB.
 */
export interface AgentContext {
  ctx: TenantCtx;
  providers: ProviderRegistry;
  store: CoreStore;
  /** Config del agente ya resuelta contra su `configSchema`. */
  config: Record<string, unknown>;
}

/** Salida de una corrida: recomendaciones nuevas (y, opcional, un resumen para UI/logs). */
export interface AgentRunOutput {
  recomendaciones: RecomendacionNueva[];
  resumen?: string;
}

/**
 * Un agente = manifest (se describe) + run (produce recomendaciones leyendo
 * capacidades). Vive en `packages/agents` y usa solo contracts + core.
 */
export interface Agent {
  manifest: AgentManifest;
  run(context: AgentContext): Promise<AgentRunOutput>;
}
