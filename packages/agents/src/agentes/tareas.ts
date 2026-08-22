import type { Agent, AgentContext, AgentManifest, AgentRunOutput } from "@agent-core/contracts";

/**
 * Agente de ejemplo (genérico, tipo "generico"): Tareas / Prioridades.
 * Sirve para validar el contrato `Agent` end-to-end. No requiere capacidades ni IA.
 * STUB: hoy no lee tareas ni prioriza; devuelve vacío.
 */
export const manifestTareas: AgentManifest = {
  id: "tareas",
  version: "0.1.0",
  nombre: "Tareas / Prioridades",
  descripcion: "Ordena qué hacer primero a partir de tareas y recomendaciones abiertas.",
  categoria: "organizacion",
  requiereCapacidades: [],
  requiereTools: [],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteTareas: Agent = {
  manifest: manifestTareas,
  async run(_context: AgentContext): Promise<AgentRunOutput> {
    // TODO: leer tareas/recomendaciones abiertas y priorizarlas.
    return { recomendaciones: [] };
  },
};
