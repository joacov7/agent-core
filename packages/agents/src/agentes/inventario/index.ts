import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { clasificarExistencia } from "./inventario.logic.js";

export * from "./inventario.logic.js";

/**
 * Inventario. Reponer o frenar: alerta quiebres y stock por debajo del mínimo.
 */
export const manifestInventario: AgentManifest = {
  id: "inventario",
  version: "0.1.0",
  nombre: "Inventario",
  descripcion: "Alerta quiebres de stock y ítems por debajo del mínimo.",
  categoria: "operaciones",
  requiereCapacidades: ["inventory", "catalog"],
  requiereTools: ["consultar_inventario", "consultar_catalogo"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

export const agenteInventario: Agent = {
  manifest: manifestInventario,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const inventory = providers.inventory;
    if (!inventory) return { recomendaciones: [] };

    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await inventory.lowStock(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const ex of items) {
      const alerta = clasificarExistencia({
        cantidad: ex.cantidad,
        ...(ex.minimo != null ? { minimo: ex.minimo } : {}),
      });
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestInventario.id,
        tipo: alerta.tipo,
        titulo: `${alerta.tipo === "quiebre" ? "Quiebre de stock" : "Reponer"}: ítem ${ex.catalogoItemId} (${alerta.motivo})`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "catalogo_item", id: ex.catalogoItemId },
        dedupKey: `inventario:${alerta.tipo}:${ex.catalogoItemId}`,
        evidencia: { observado: { cantidad: ex.cantidad, minimo: ex.minimo } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} alerta(s) de inventario.` };
  },
};
