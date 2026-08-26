import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { calcularReposicion } from "./compras.logic.js";

export * from "./compras.logic.js";

/**
 * Compras / Proveedores. Qué comprar: sugiere reposición para los ítems en quiebre o
 * bajo el mínimo, indicando cuántos proveedores hay disponibles para gestionarla.
 */
export const manifestCompras: AgentManifest = {
  id: "compras",
  version: "0.1.0",
  nombre: "Compras / Proveedores",
  descripcion: "Sugiere reposición de stock y a cuántos proveedores recurrir.",
  categoria: "operaciones",
  requiereCapacidades: ["suppliers", "inventory"],
  requiereTools: ["consultar_inventario", "consultar_proveedores"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

export const agenteCompras: Agent = {
  manifest: manifestCompras,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const inventory = providers.inventory;
    const suppliers = providers.suppliers;
    if (!inventory || !suppliers) return { recomendaciones: [] };

    const [bajos, proveedores] = await Promise.all([inventory.lowStock(ctx), suppliers.list(ctx)]);
    const nProveedores = proveedores.items.length;
    const confianza = confianzaPorOrigen("deterministico");
    const recomendaciones: RecomendacionNueva[] = [];

    for (const ex of bajos.items) {
      const alerta = calcularReposicion({
        cantidad: ex.cantidad, ...(ex.minimo != null ? { minimo: ex.minimo } : {}),
      });
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestCompras.id,
        tipo: "comprar",
        titulo: `Comprar ${alerta.cantidadSugerida} u. de ítem ${ex.catalogoItemId} (${alerta.motivo})`,
        descripcion: `${nProveedores} proveedor(es) disponible(s) para gestionar la compra.`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "catalogo_item", id: ex.catalogoItemId },
        dedupKey: `compras:${ex.catalogoItemId}`,
        evidencia: { observado: { cantidad: ex.cantidad, minimo: ex.minimo, cantidadSugerida: alerta.cantidadSugerida } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} compra(s) sugerida(s).` };
  },
};
