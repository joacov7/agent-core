import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { evaluarEntrega } from "./logistica.logic.js";

export * from "./logistica.logic.js";

/**
 * Logística. Entregas y demoras: marca las entregas demoradas o inminentes.
 */
export const manifestLogistica: AgentManifest = {
  id: "logistica",
  version: "0.1.0",
  nombre: "Logística",
  descripcion: "Marca entregas demoradas o próximas.",
  categoria: "operaciones",
  requiereCapacidades: ["logistics"],
  requiereTools: ["consultar_logistica"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

export const agenteLogistica: Agent = {
  manifest: manifestLogistica,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const logistics = providers.logistics;
    if (!logistics) return { recomendaciones: [] };

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await logistics.deliveries(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const entrega of items) {
      const alerta = evaluarEntrega(
        { estado: entrega.estado, ...(entrega.venceEn ? { venceEn: entrega.venceEn } : {}) }, hoy,
      );
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestLogistica.id,
        tipo: "entrega",
        titulo: `${entrega.titulo} (${alerta.motivo})`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "tarea", id: entrega.id },
        dedupKey: `logistica:${entrega.id}`,
        evidencia: { observado: { estado: entrega.estado, venceEn: entrega.venceEn ?? null, diasHasta: alerta.diasHasta } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} entrega(s) a atender.` };
  },
};
