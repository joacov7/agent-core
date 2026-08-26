import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { evaluarProceso } from "./produccion.logic.js";

export * from "./produccion.logic.js";

/**
 * Producción / Mantenimiento. Cuellos, paradas y service: marca procesos demorados
 * o próximos a vencer.
 */
export const manifestProduccion: AgentManifest = {
  id: "produccion",
  version: "0.1.0",
  nombre: "Producción / Mantenimiento",
  descripcion: "Marca procesos productivos demorados o próximos a vencer.",
  categoria: "operaciones",
  requiereCapacidades: ["production"],
  requiereTools: ["consultar_produccion"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

export const agenteProduccion: Agent = {
  manifest: manifestProduccion,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const production = providers.production;
    if (!production) return { recomendaciones: [] };

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await production.processes(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const proc of items) {
      const alerta = evaluarProceso(
        { estado: proc.estado, ...(proc.venceEn ? { venceEn: proc.venceEn } : {}) }, hoy,
      );
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestProduccion.id,
        tipo: "proceso",
        titulo: `${proc.titulo} (${alerta.motivo})`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "tarea", id: proc.id },
        dedupKey: `produccion:${proc.id}`,
        evidencia: { observado: { estado: proc.estado, venceEn: proc.venceEn ?? null, diasHasta: alerta.diasHasta } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} proceso(s) a atender.` };
  },
};
