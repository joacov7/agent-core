import type { Agent, AgentContext, AgentManifest, AgentRunOutput } from "@agent-core/contracts";

export * from "./rentabilidad.logic.js";

/**
 * Rentabilidad. Alerta por margen bajo, capital inmovilizado y alto margen sin explotar.
 * Semántica de costo/margen sobre COGS: asume catálogo de productos de compra repetida.
 */
export const manifestRentabilidad: AgentManifest = {
  id: "rentabilidad",
  version: "0.1.0",
  nombre: "Rentabilidad",
  descripcion: "Clasifica productos por margen bajo, inmovilizado y oportunidad de margen.",
  categoria: "finanzas",
  requiereCapacidades: ["catalog", "transactions"],
  requiereTools: ["consultar_catalogo", "consultar_transacciones"],
  modelosNegocio: ["transaccional_repetitivo"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteRentabilidad: Agent = {
  manifest: manifestRentabilidad,
  async run(_context: AgentContext): Promise<AgentRunOutput> {
    // TODO(wiring): clasificarRentabilidad necesita, por ítem, precio/costo (los da
    // CatalogProvider) pero también ventas_30d y valor_inmovilizado (transactions +
    // inventory). Sin esos agregados no se puede clasificar sin fabricar datos.
    // La lógica está portada y testeada.
    return { recomendaciones: [] };
  },
};
