import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { evaluarPostventa } from "./postventa.logic.js";

export * from "./postventa.logic.js";

/**
 * Postventa / Recompra. Pide reseña tras la compra o propone recompra en la ventana
 * del próximo ciclo. Asume compra repetida (cadencia transaccional/suscripción).
 */
export const manifestPostventa: AgentManifest = {
  id: "postventa",
  version: "0.1.0",
  nombre: "Postventa / Recompra",
  descripcion: "Reseña tras la compra y recompra en la ventana del próximo ciclo.",
  categoria: "clientes",
  requiereCapacidades: ["contacts", "transactions"],
  requiereTools: ["consultar_contactos", "consultar_transacciones"],
  modelosNegocio: ["transaccional_repetitivo", "suscripcion"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

export const agentePostventa: Agent = {
  manifest: manifestPostventa,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const tx = providers.transactions;
    if (!tx?.resumenPorContacto) {
      return { recomendaciones: [], resumen: "El adaptador no expone resumenPorContacto (transactions)." };
    }

    const { items } = await tx.resumenPorContacto(ctx);
    const confianza = confianzaPorOrigen("calculo");
    const recomendaciones: RecomendacionNueva[] = [];

    for (const r of items) {
      const alerta = evaluarPostventa({
        compras: r.compras, diasDesdeUltima: r.diasDesdeUltima, frecuenciaDias: r.frecuenciaDias ?? null,
      });
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestPostventa.id,
        tipo: `postventa_${alerta.tipo}`,
        titulo: alerta.tipo === "resena" ? `Pedir reseña a contacto ${r.contactoId}` : `Ofrecer recompra a contacto ${r.contactoId}`,
        descripcion: alerta.motivo,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "calculo",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "contacto", id: r.contactoId },
        dedupKey: `postventa:${alerta.tipo}:${r.contactoId}`,
        evidencia: { observado: { diasDesdeUltima: r.diasDesdeUltima, frecuenciaDias: r.frecuenciaDias } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} acción(es) de postventa.` };
  },
};
