import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { evaluarChurn } from "./churn.logic.js";

export * from "./churn.logic.js";

/**
 * Riesgo de abandono (churn). Detecta clientes que se pasaron de su frecuencia
 * habitual. Asume compra repetida: restringido a cadencias transaccional/suscripción.
 */
export const manifestRiesgoAbandono: AgentManifest = {
  id: "riesgo_abandono",
  version: "0.1.0",
  nombre: "Riesgo de abandono",
  descripcion: "Detecta clientes en riesgo de churn por recencia vs frecuencia.",
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

export const agenteRiesgoAbandono: Agent = {
  manifest: manifestRiesgoAbandono,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const tx = providers.transactions;
    if (!tx?.resumenPorContacto) {
      return { recomendaciones: [], resumen: "El adaptador no expone resumenPorContacto (transactions)." };
    }

    const { items } = await tx.resumenPorContacto(ctx);
    const confianza = confianzaPorOrigen("calculo");
    const recomendaciones: RecomendacionNueva[] = [];

    for (const r of items) {
      const alerta = evaluarChurn({
        compras: r.compras, diasDesdeUltima: r.diasDesdeUltima, frecuenciaDias: r.frecuenciaDias ?? null,
      });
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestRiesgoAbandono.id,
        tipo: `churn_${alerta.nivel}`,
        titulo: `Cliente ${alerta.nivel.replace("_", " ")} (${alerta.ratio}x su frecuencia)`,
        descripcion: `Contacto ${r.contactoId}: ${r.diasDesdeUltima} días desde la última compra.`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "calculo",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "contacto", id: r.contactoId },
        dedupKey: `riesgo_abandono:contacto:${r.contactoId}`,
        evidencia: { calculo: { diasDesdeUltima: r.diasDesdeUltima, frecuenciaDias: r.frecuenciaDias, ratio: alerta.ratio } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} cliente(s) en riesgo de abandono.` };
  },
};
