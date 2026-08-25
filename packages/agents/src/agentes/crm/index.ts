import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva, ResumenContacto,
} from "@agent-core/contracts";
import { calcularPrioridad } from "@agent-core/core";
import { scoreCliente, ameritaReactivacion, type MetricasCliente } from "./crm.logic.js";

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

// ResumenContacto (canónico camelCase) → MetricasCliente (shape de la lógica portada).
function aMetricas(r: ResumenContacto): MetricasCliente {
  return {
    key: r.contactoId, nombre: r.contactoId, email: null, telefono: null,
    compras: r.compras, total_gastado: r.totalGastado, ticket_promedio: r.ticketPromedio,
    ultima_compra: r.ultimaTransaccion ?? new Date(0).toISOString(),
    dias_desde_ultima: r.diasDesdeUltima, frecuencia_dias: r.frecuenciaDias ?? null,
  };
}

export const agenteCrm: Agent = {
  manifest: manifestCrm,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const tx = providers.transactions;
    if (!tx?.resumenPorContacto) {
      return { recomendaciones: [], resumen: "El adaptador no expone resumenPorContacto (transactions)." };
    }

    const page = await tx.resumenPorContacto(ctx);
    const maxValor = Math.max(0, ...page.items.map((r) => r.totalGastado));
    const recomendaciones: RecomendacionNueva[] = [];

    for (const r of page.items) {
      const m = aMetricas(r);
      const score = scoreCliente(m, { maxValor });
      if (!ameritaReactivacion(m, score, { maxValor })) continue;

      recomendaciones.push({
        agentId: manifestCrm.id,
        tipo: "reactivacion",
        titulo: `Reactivar cliente valioso en riesgo (${score.score}/100)`,
        descripcion: `${score.proxima_accion}. ${score.motivos.join("; ")}.`,
        estado: "proposed",
        severidad: "importante",
        confianza: score.confianza,
        prioridad: calcularPrioridad({ severidad: "importante", confianza: score.confianza, valorEsperado: null }),
        refEntidad: { tipo: "contacto", id: r.contactoId },
        dedupKey: `crm:reactivacion:contacto:${r.contactoId}`,
        evidencia: { observado: { score: score.score, riesgo: score.riesgo_abandono, motivos: score.motivos } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} cliente(s) valioso(s) en riesgo a reactivar.` };
  },
};
