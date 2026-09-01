import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { calcularNps, detractores, type RespuestaNps } from "./nps.logic.js";

export * from "./nps.logic.js";

/**
 * Reputación / NPS. Calcula el NPS de las respuestas de satisfacción y abre un
 * seguimiento por cada detractor (recuperación de reputación). Genérico: sirve para
 * cualquier rubro que aporte la capacidad `feedback`.
 */
export const manifestNps: AgentManifest = {
  id: "nps",
  version: "0.1.0",
  nombre: "Reputación / NPS",
  descripcion: "Calcula el NPS y prioriza el seguimiento de los detractores para recuperar reputación.",
  categoria: "clientes",
  requiereCapacidades: ["feedback"],
  requiereTools: ["consultar_feedback"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteNps: Agent = {
  manifest: manifestNps,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    if (!providers.feedback) return { recomendaciones: [], resumen: "Falta la capacidad feedback." };

    const { items } = await providers.feedback.responses(ctx);
    const respuestas: RespuestaNps[] = items.map((f) => ({
      id: f.id,
      contactoId: f.contactoId ?? null,
      puntaje: f.puntaje,
      escala: f.escala ?? 10,
      comentario: f.comentario ?? null,
    }));

    const resumen = calcularNps(respuestas);
    const confianza = confianzaPorOrigen("deterministico");
    const recomendaciones: RecomendacionNueva[] = detractores(respuestas).map((d) => ({
      agentId: manifestNps.id,
      tipo: "reputacion_detractor",
      titulo: `Recuperar detractor (puntaje ${d.puntaje}${d.escala !== 10 ? `/${d.escala}` : ""})`,
      descripcion: d.comentario ?? "Respuesta de baja satisfacción sin comentario.",
      estado: "proposed",
      severidad: "importante",
      confianza,
      origenConfianza: "deterministico",
      prioridad: calcularPrioridad({ severidad: "importante", confianza, valorEsperado: null }),
      ...(d.contactoId ? { refEntidad: { tipo: "contacto", id: d.contactoId } } : {}),
      dedupKey: `nps:reputacion_detractor:${d.id}`,
      evidencia: { observado: { puntaje: d.puntaje, escala: d.escala, comentario: d.comentario } },
    }));

    return {
      recomendaciones,
      resumen: `NPS ${resumen.nps} (${resumen.total} respuestas: ${resumen.promotores} prom / ${resumen.pasivos} pas / ${resumen.detractores} det).`,
    };
  },
};
