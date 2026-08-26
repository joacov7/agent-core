import type { Agent, AgentContext, AgentManifest, AgentRunOutput } from "@agent-core/contracts";
import { resumenEjecutivo, type RecoResumen } from "./ceo.logic.js";

export * from "./ceo.logic.js";

/**
 * CEO. Estado del negocio + prioridades del día, a partir de las recomendaciones ya
 * generadas (leídas del CoreStore). No emite recomendaciones nuevas: produce un
 * resumen. Genérico (solo necesita la infraestructura de Recommendations).
 */
export const manifestCeo: AgentManifest = {
  id: "ceo",
  version: "0.1.0",
  nombre: "CEO",
  descripcion: "Estado del negocio y prioridades del día.",
  categoria: "direccion",
  requiereCapacidades: [],
  requiereTools: ["consultar_recomendaciones"],
  nivelIA: "redacta",
  costoEstimado: "bajo",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteCeo: Agent = {
  manifest: manifestCeo,
  async run({ ctx, store }: AgentContext): Promise<AgentRunOutput> {
    const { items } = await store.recommendations.list(ctx);
    const resumen: RecoResumen[] = items.map((r) => ({ severidad: r.severidad, prioridad: r.prioridad, titulo: r.titulo }));
    const ejecutivo = resumenEjecutivo(resumen);
    return { recomendaciones: [], resumen: ejecutivo.texto };
  },
};
