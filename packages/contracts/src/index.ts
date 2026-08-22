// @agent-core/contracts — tipos canónicos + interfaces de providers + Manifest.
// Sin lógica. Lo importan agent-core, agents y las apps (para tipar sus adapters).

export type * from "./common.js";
export type * from "./tenant.js";
export type * from "./autonomy.js";
export type * from "./capabilities.js";

// Modelo canónico (Capa 1 + Capa 2 + bucle + memoria).
export type * from "./canonical/index.js";

// Manifest + tools.
export type * from "./manifest.js";
export type * from "./tools.js";

// Contrato de providers (capacidades, IA, CoreStore, registry).
export type * from "./providers/index.js";

// Agente (manifest + run).
export type * from "./agent.js";
