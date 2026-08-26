import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, CatalogoItem, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { posicionMercado } from "./competencia.logic.js";

export * from "./competencia.logic.js";

/**
 * Competencia. Posición vs mercado: ubica cada ítem con evidencia de precio de
 * competencia como caro, en línea o barato. Informativo (no cambia precios).
 */
export const manifestCompetencia: AgentManifest = {
  id: "competencia",
  version: "0.1.0",
  nombre: "Competencia",
  descripcion: "Posición de precios vs el mercado.",
  categoria: "comercial",
  requiereCapacidades: ["competition", "catalog"],
  requiereTools: ["consultar_catalogo"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteCompetencia: Agent = {
  manifest: manifestCompetencia,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const competition = providers.competition;
    const catalog = providers.catalog;
    if (!competition || !catalog) return { recomendaciones: [] };

    const [evidencias, catalogo] = await Promise.all([
      competition.marketEvidence(ctx),
      catalog.items(ctx),
    ]);
    const porId = new Map<string, CatalogoItem>(catalogo.items.map((i) => [i.id, i]));
    const confianza = confianzaPorOrigen("calculo");
    const recomendaciones: RecomendacionNueva[] = [];

    for (const ev of evidencias.items) {
      const item = ev.refEntidad ? porId.get(ev.refEntidad.id) : undefined;
      if (!item || item.precio == null || ev.precio == null) continue;

      const alerta = posicionMercado(item.precio, ev.precio);
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestCompetencia.id,
        tipo: `competencia_${alerta.posicion}`,
        titulo: `${item.nombre}: ${alerta.gapPct > 0 ? "+" : ""}${alerta.gapPct}% vs mercado`,
        descripcion: `Nuestro precio ${item.precio} vs mercado ${ev.precio} (fuente: ${ev.fuente}).`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "calculo",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "catalogo_item", id: item.id },
        dedupKey: `competencia:${item.id}`,
        evidencia: {
          observado: { nuestroPrecio: item.precio, precioMercado: ev.precio, gapPct: alerta.gapPct },
          fuentes: [{ fuente: ev.fuente, fecha: ev.observadoEn }],
        },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} ítem(s) fuera de línea con el mercado.` };
  },
};
