import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { evaluarVenta } from "./ventas.logic.js";

export * from "./ventas.logic.js";

/**
 * Ventas / Ofertas. Empuja el pipeline: prioriza las oportunidades abiertas por
 * valor esperado (valor × probabilidad) para cerrarlas. (Armar la oferta con el
 * catálogo es una extensión futura.)
 */
export const manifestVentas: AgentManifest = {
  id: "ventas",
  version: "0.1.0",
  nombre: "Ventas / Ofertas",
  descripcion: "Prioriza oportunidades por valor esperado para empujarlas a cierre.",
  categoria: "comercial",
  requiereCapacidades: ["pipeline"],
  requiereTools: ["consultar_pipeline"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

export const agenteVentas: Agent = {
  manifest: manifestVentas,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const pipeline = providers.pipeline;
    if (!pipeline) return { recomendaciones: [] };

    const { items } = await pipeline.open(ctx);
    const confianza = confianzaPorOrigen("calculo");
    const recomendaciones: RecomendacionNueva[] = [];

    for (const op of items) {
      const alerta = evaluarVenta({
        ...(op.valorEstimado != null ? { valorEstimado: op.valorEstimado } : {}),
        ...(op.probabilidad != null ? { probabilidad: op.probabilidad } : {}),
      });
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestVentas.id,
        tipo: "venta",
        titulo: `Empujar: ${op.titulo} (valor esperado ${alerta.valorPonderado})`,
        descripcion: `Oportunidad ${op.id} en etapa "${op.etapa}".`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "calculo",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: alerta.valorPonderado }),
        impactoEstimado: alerta.valorPonderado,
        refEntidad: { tipo: "oportunidad", id: op.id },
        dedupKey: `ventas:${op.id}`,
        evidencia: { calculo: { valorEstimado: op.valorEstimado ?? null, probabilidad: op.probabilidad ?? null, valorPonderado: alerta.valorPonderado } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} oportunidad(es) a empujar.` };
  },
};
