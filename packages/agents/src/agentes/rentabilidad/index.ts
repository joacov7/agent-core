import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva, ResumenItem,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { clasificarRentabilidad, type RentabilidadItem } from "./rentabilidad.logic.js";

export * from "./rentabilidad.logic.js";

/**
 * Rentabilidad. Alerta por margen bajo, capital inmovilizado y alto margen sin explotar.
 * Semántica de costo/margen sobre COGS: asume catálogo de productos de compra repetida.
 */
export const manifestRentabilidad: AgentManifest = {
  id: "rentabilidad",
  version: "0.1.0",
  nombre: "Rentabilidad",
  descripcion: "Clasifica productos por margen bajo, inmovilizado y oportunidad de margen.",
  categoria: "finanzas",
  requiereCapacidades: ["catalog", "transactions"],
  requiereTools: ["consultar_catalogo", "consultar_transacciones"],
  modelosNegocio: ["transaccional_repetitivo"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

// ResumenItem (canónico) → RentabilidadItem (shape de la lógica portada).
function aItem(r: ResumenItem): RentabilidadItem {
  return {
    id: r.catalogoItemId, nombre: r.nombre, precio: r.precio, costo: r.costo ?? null,
    margen_pct: r.margenPct ?? null, ventas_30d: r.ventas30d, stock: r.stock,
    valor_inmovilizado: r.valorInmovilizado ?? null,
  };
}

export const agenteRentabilidad: Agent = {
  manifest: manifestRentabilidad,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const catalog = providers.catalog;
    if (!catalog?.resumenRentabilidad) {
      return { recomendaciones: [], resumen: "El adaptador no expone resumenRentabilidad (catalog)." };
    }

    const page = await catalog.resumenRentabilidad(ctx);
    const confianza = confianzaPorOrigen("calculo"); // clasificación sobre datos ciertos
    const recomendaciones: RecomendacionNueva[] = [];

    for (const r of page.items) {
      const alerta = clasificarRentabilidad(aItem(r));
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestRentabilidad.id,
        tipo: alerta.tipo,
        titulo: alerta.titulo,
        descripcion: alerta.descripcion,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: alerta.impactoEstimado }),
        impactoEstimado: alerta.impactoEstimado,
        refEntidad: { tipo: "catalogo_item", id: r.catalogoItemId },
        dedupKey: `rentabilidad:${alerta.tipo}:item:${r.catalogoItemId}`,
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} alerta(s) de rentabilidad.` };
  },
};
