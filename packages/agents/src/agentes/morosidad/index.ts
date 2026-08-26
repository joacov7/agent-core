import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { clasificarMora } from "./morosidad.logic.js";
import { diasVencido } from "../cobros/cobros.logic.js";

export * from "./morosidad.logic.js";

/**
 * Morosidad. Riesgo de incobrable, escalonado: clasifica el nivel de mora de cada
 * cobro vencido y sugiere la acción del escalón. Complementa a Cobros (que prioriza
 * qué cobrar hoy); acá el foco es el riesgo y la escalera de gestión.
 */
export const manifestMorosidad: AgentManifest = {
  id: "morosidad",
  version: "0.1.0",
  nombre: "Morosidad",
  descripcion: "Clasifica el nivel de mora y escala la gestión de cobranza.",
  categoria: "finanzas",
  requiereCapacidades: ["receivables", "contacts"],
  requiereTools: ["consultar_cobros", "consultar_contactos"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

export const agenteMorosidad: Agent = {
  manifest: manifestMorosidad,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const receivables = providers.receivables;
    if (!receivables) return { recomendaciones: [] };

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await receivables.overdue(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const cobro of items) {
      if (cobro.estado === "cobrado" || cobro.estado === "incobrable") continue;
      const dias = diasVencido(cobro.venceEn, hoy);
      const alerta = clasificarMora(dias);
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestMorosidad.id,
        tipo: `mora_${alerta.nivel}`,
        titulo: `Mora ${alerta.nivel} (${dias}d): ${alerta.accion}`,
        descripcion: `Cobro ${cobro.id} del contacto ${cobro.contactoId} por ${cobro.monto}${cobro.moneda ? ` ${cobro.moneda}` : ""}.`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: cobro.monto }),
        impactoEstimado: cobro.monto,
        refEntidad: { tipo: "cobro", id: cobro.id },
        dedupKey: `morosidad:${cobro.id}`,
        evidencia: { observado: { diasVencido: dias, nivel: alerta.nivel, monto: cobro.monto } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} cobro(s) en mora clasificados.` };
  },
};
