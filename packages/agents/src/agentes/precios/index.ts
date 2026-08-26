import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, CatalogoItem, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { sugerirPrecio } from "./precios.logic.js";

export * from "./precios.logic.js";

/**
 * Precios. Ajuste de precio: sugiere alinear al mercado respetando el margen mínimo.
 * Es accionable (tool `aplicar_precio`) y de riesgo alto: cambia precios, por eso su
 * autonomía máxima es manual y el enforcement del Core intercepta la acción.
 */
export const manifestPrecios: AgentManifest = {
  id: "precios",
  version: "0.1.0",
  nombre: "Precios",
  descripcion: "Sugiere ajustes de precio alineados al mercado con piso de margen.",
  categoria: "comercial",
  requiereCapacidades: ["competition", "catalog"],
  requiereTools: ["consultar_catalogo"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: true,
  toolsDeEscritura: ["aplicar_precio"],
  riesgo: "alto",
  autonomiaMaxima: "manual",
};

export const agentePrecios: Agent = {
  manifest: manifestPrecios,
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

      const sug = sugerirPrecio({ precio: item.precio, costo: item.costo ?? null, precioMercado: ev.precio });
      if (!sug) continue;

      recomendaciones.push({
        agentId: manifestPrecios.id,
        tipo: "ajuste_precio",
        titulo: `${sug.accion === "bajar" ? "Bajar" : "Subir"} precio de ${item.nombre}: ${item.precio} → ${sug.precioSugerido}`,
        descripcion: sug.motivo,
        estado: "proposed",
        severidad: "importante",
        confianza,
        origenConfianza: "calculo",
        prioridad: calcularPrioridad({ severidad: "importante", confianza, valorEsperado: null }),
        refEntidad: { tipo: "catalogo_item", id: item.id },
        dedupKey: `precios:${item.id}`,
        accionTool: "aplicar_precio",
        accionesSugeridas: [
          { toolId: "aplicar_precio", params: { catalogoItemId: item.id, precio: sug.precioSugerido }, etiqueta: sug.motivo },
        ],
        evidencia: { calculo: { precioActual: item.precio, precioMercado: ev.precio, precioSugerido: sug.precioSugerido } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} ajuste(s) de precio sugerido(s).` };
  },
};
