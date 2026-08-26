import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { calcularKpis, detectarAnomalias, type ResumenClienteKpi } from "./analista.logic.js";

export * from "./analista.logic.js";

/**
 * Analista de negocio. KPIs (clientes, ingreso, ticket global) y anomalías (clientes
 * con ticket muy por encima del promedio). Requiere `transactions`.
 */
export const manifestAnalista: AgentManifest = {
  id: "analista",
  version: "0.1.0",
  nombre: "Analista de negocio",
  descripcion: "KPIs y anomalías del negocio.",
  categoria: "direccion",
  requiereCapacidades: ["transactions"],
  requiereTools: ["consultar_transacciones"],
  nivelIA: "redacta",
  costoEstimado: "bajo",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteAnalista: Agent = {
  manifest: manifestAnalista,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const tx = providers.transactions;
    if (!tx?.resumenPorContacto) {
      return { recomendaciones: [], resumen: "El adaptador no expone resumenPorContacto (transactions)." };
    }

    const { items } = await tx.resumenPorContacto(ctx);
    const clientes: ResumenClienteKpi[] = items.map((r) => ({
      contactoId: r.contactoId, compras: r.compras, totalGastado: r.totalGastado, ticketPromedio: r.ticketPromedio,
    }));

    const kpis = calcularKpis(clientes);
    const anomalias = detectarAnomalias(clientes);
    const confianza = confianzaPorOrigen("calculo");

    const recomendaciones: RecomendacionNueva[] = anomalias.map((a) => ({
      agentId: manifestAnalista.id,
      tipo: "anomalia",
      titulo: `Ticket atípico: contacto ${a.contactoId} (${a.ratio}x el promedio)`,
      estado: "proposed",
      severidad: "oportunidad",
      confianza,
      origenConfianza: "calculo",
      prioridad: calcularPrioridad({ severidad: "oportunidad", confianza, valorEsperado: null }),
      refEntidad: { tipo: "contacto", id: a.contactoId },
      dedupKey: `analista:anomalia:${a.contactoId}`,
      evidencia: { calculo: { ratio: a.ratio, ticketPromedioGlobal: kpis.ticketPromedioGlobal } },
    }));

    return {
      recomendaciones,
      resumen: `KPIs: ${kpis.clientes} cliente(s), ingreso ${kpis.ingresoTotal}, ticket global ${kpis.ticketPromedioGlobal}. ${anomalias.length} anomalía(s).`,
    };
  },
};
