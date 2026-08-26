import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { clasificarEvento } from "./agenda.logic.js";

export * from "./agenda.logic.js";

/**
 * Agenda / Vencimientos. Marca eventos próximos o vencidos (turnos, audiencias,
 * plazos, vencimientos de AFIP…). Genérico sobre la capacidad `agenda`.
 */
export const manifestAgenda: AgentManifest = {
  id: "agenda",
  version: "0.1.0",
  nombre: "Agenda / Vencimientos",
  descripcion: "Avisa de eventos próximos o vencidos.",
  categoria: "organizacion",
  requiereCapacidades: ["agenda"],
  requiereTools: ["consultar_agenda"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteAgenda: Agent = {
  manifest: manifestAgenda,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const agenda = providers.agenda;
    if (!agenda) return { recomendaciones: [] };

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await agenda.upcoming(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const evento of items) {
      const alerta = clasificarEvento(evento.inicia, hoy);
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestAgenda.id,
        tipo: "vencimiento",
        titulo: `${evento.titulo} (${alerta.motivo})`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "evento", id: evento.id },
        dedupKey: `agenda:vencimiento:${evento.id}`,
        evidencia: { observado: { tipo: evento.tipo, inicia: evento.inicia, diasHasta: alerta.diasHasta } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} evento(s) por atender.` };
  },
};
