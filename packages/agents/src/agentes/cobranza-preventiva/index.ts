import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { clasificarPreventivo, diasHastaVencimiento } from "./cobranza-preventiva.logic.js";

export * from "./cobranza-preventiva.logic.js";

/**
 * Cobranza preventiva. Recuerda los cobros que están POR vencer (antes de la mora),
 * para gestionarlos a tiempo. Genérico; complementa a Cobros (vencido) y Morosidad
 * (mora avanzada).
 */
export const manifestCobranzaPreventiva: AgentManifest = {
  id: "cobranza_preventiva",
  version: "0.1.0",
  nombre: "Cobranza preventiva",
  descripcion: "Recuerda los cobros por vencer dentro de una ventana, antes de que caigan en mora.",
  categoria: "finanzas",
  requiereCapacidades: ["receivables", "contacts"],
  requiereTools: ["consultar_cobros", "consultar_contactos"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "assisted",
};

export const agenteCobranzaPreventiva: Agent = {
  manifest: manifestCobranzaPreventiva,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const receivables = providers.receivables;
    if (!receivables) return { recomendaciones: [] };

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await receivables.pending(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const cobro of items) {
      const dias = diasHastaVencimiento(cobro.venceEn, hoy);
      if (dias == null) continue; // sin vencimiento → no hay nada preventivo que avisar
      const alerta = clasificarPreventivo({ estado: cobro.estado, monto: cobro.monto, diasHastaVencimiento: dias });
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestCobranzaPreventiva.id,
        tipo: "cobro_por_vencer",
        titulo: `Recordar cobro ${cobro.monto}${cobro.moneda ? ` ${cobro.moneda}` : ""} (${alerta.motivo})`,
        descripcion: `Cobro ${cobro.id} del contacto ${cobro.contactoId}.`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: cobro.monto }),
        impactoEstimado: cobro.monto,
        refEntidad: { tipo: "cobro", id: cobro.id },
        dedupKey: `cobranza_preventiva:cobro_por_vencer:${cobro.id}`,
        evidencia: { observado: { estado: cobro.estado, monto: cobro.monto, diasHastaVencimiento: dias } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} cobro(s) por vencer.` };
  },
};
