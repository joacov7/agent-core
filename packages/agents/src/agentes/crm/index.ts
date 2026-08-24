import type { Agent, AgentContext, AgentManifest, AgentRunOutput } from "@agent-core/contracts";

export * from "./crm.logic.js";

/**
 * CRM / Customer Score. Calcula valor, riesgo de abandono y próxima acción por cliente.
 * Asume compra repetida: solo aplica a modelos de negocio con cadencia recurrente.
 */
export const manifestCrm: AgentManifest = {
  id: "crm",
  version: "0.1.0",
  nombre: "CRM / Customer Score",
  descripcion: "Score de valor y riesgo de abandono por cliente, con próxima acción.",
  categoria: "clientes",
  requiereCapacidades: ["contacts", "transactions"],
  requiereTools: ["consultar_contactos", "consultar_transacciones"],
  modelosNegocio: ["transaccional_repetitivo", "suscripcion"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteCrm: Agent = {
  manifest: manifestCrm,
  async run(_context: AgentContext): Promise<AgentRunOutput> {
    // TODO(wiring): scoreCliente/ameritaReactivacion necesitan agregados por contacto
    // (compras, total_gastado, ticket_promedio, dias_desde_ultima, frecuencia_dias) que
    // hoy no expone TransactionsProvider. Falta una capa de agregación (o métodos tipo
    // `TransactionsProvider.aggregateByContact`). La lógica está portada y testeada.
    return { recomendaciones: [] };
  },
};
