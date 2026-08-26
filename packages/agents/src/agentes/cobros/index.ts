import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { clasificarCobro, diasVencido } from "./cobros.logic.js";

export * from "./cobros.logic.js";

/**
 * Cobros. Qué cobrar hoy: prioriza los cobros vencidos por urgencia. Genérico
 * (aplica a cualquier cadencia con cuentas por cobrar).
 */
export const manifestCobros: AgentManifest = {
  id: "cobros",
  version: "0.1.0",
  nombre: "Cobros",
  descripcion: "Prioriza qué cobrar hoy a partir de los cobros vencidos.",
  categoria: "finanzas",
  requiereCapacidades: ["receivables", "contacts"],
  requiereTools: ["consultar_cobros", "consultar_contactos"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "assisted",
};

export const agenteCobros: Agent = {
  manifest: manifestCobros,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const receivables = providers.receivables;
    if (!receivables) return { recomendaciones: [] };

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await receivables.overdue(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const cobro of items) {
      const dias = diasVencido(cobro.venceEn, hoy);
      const alerta = clasificarCobro({ estado: cobro.estado, monto: cobro.monto, diasVencido: dias });
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestCobros.id,
        tipo: "cobro_vencido",
        titulo: `Cobrar ${cobro.monto}${cobro.moneda ? ` ${cobro.moneda}` : ""} (${alerta.motivo})`,
        descripcion: `Cobro ${cobro.id} del contacto ${cobro.contactoId}.`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: cobro.monto }),
        impactoEstimado: cobro.monto,
        refEntidad: { tipo: "cobro", id: cobro.id },
        dedupKey: `cobros:cobro_vencido:${cobro.id}`,
        evidencia: { observado: { estado: cobro.estado, monto: cobro.monto, diasVencido: dias } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} cobro(s) vencido(s) a gestionar.` };
  },
};
