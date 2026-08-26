import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { evaluarSeguimiento } from "./seguimiento.logic.js";

export * from "./seguimiento.logic.js";

/**
 * Seguimiento. Lo que quedó sin cerrar: empuja oportunidades abiertas con cierre
 * vencido, próximas a vencer o sin próximo paso. Genérico sobre `pipeline`.
 */
export const manifestSeguimiento: AgentManifest = {
  id: "seguimiento",
  version: "0.1.0",
  nombre: "Seguimiento",
  descripcion: "Empuja oportunidades abiertas que quedaron sin cerrar.",
  categoria: "clientes",
  requiereCapacidades: ["contacts", "pipeline"],
  requiereTools: ["consultar_contactos", "consultar_pipeline"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

export const agenteSeguimiento: Agent = {
  manifest: manifestSeguimiento,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const pipeline = providers.pipeline;
    if (!pipeline) return { recomendaciones: [] };

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await pipeline.open(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const op of items) {
      const alerta = evaluarSeguimiento(
        op.cierreEstimado ? { cierreEstimado: op.cierreEstimado } : {}, hoy,
      );
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestSeguimiento.id,
        tipo: "seguimiento",
        titulo: `Seguir: ${op.titulo} (${alerta.motivo})`,
        descripcion: `Oportunidad ${op.id} en etapa "${op.etapa}".`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({
          severidad: alerta.severidad, confianza,
          valorEsperado: op.valorEstimado ?? null,
        }),
        ...(op.valorEstimado != null ? { impactoEstimado: op.valorEstimado } : {}),
        refEntidad: { tipo: "oportunidad", id: op.id },
        dedupKey: `seguimiento:oportunidad:${op.id}`,
        evidencia: { observado: { etapa: op.etapa, cierreEstimado: op.cierreEstimado ?? null } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} oportunidad(es) a seguir.` };
  },
};
