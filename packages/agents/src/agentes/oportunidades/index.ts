import type { Agent, AgentContext, AgentManifest, AgentRunOutput } from "@agent-core/contracts";

export * from "./oportunidades.logic.js";

/**
 * Oportunidades / Venta cruzada. Sugiere el complementario que le falta a cada cliente
 * a partir de la canasta (co-ocurrencia). Asume canasta multi-ítem de compra repetida.
 */
export const manifestOportunidades: AgentManifest = {
  id: "oportunidades",
  version: "0.1.0",
  nombre: "Oportunidades / Venta cruzada",
  descripcion: "Detecta venta cruzada por co-ocurrencia de productos en la canasta.",
  categoria: "clientes",
  requiereCapacidades: ["contacts", "catalog"],
  requiereTools: ["consultar_contactos", "consultar_catalogo", "consultar_transacciones"],
  modelosNegocio: ["transaccional_repetitivo"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteOportunidades: Agent = {
  manifest: manifestOportunidades,
  async run(_context: AgentContext): Promise<AgentRunOutput> {
    // TODO(wiring): detectarVentaCruzada necesita los pares complementarios (canasta:
    // co-ocurrencia de ítems) y los productos por cliente (ClienteProductos), que se
    // derivan de las líneas de las transacciones. Falta esa agregación en los providers.
    // La lógica está portada y testeada.
    return { recomendaciones: [] };
  },
};
