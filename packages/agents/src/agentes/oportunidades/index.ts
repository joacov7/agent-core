import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad } from "@agent-core/core";
import {
  detectarVentaCruzada, type ParComplementario, type ClienteProductos,
} from "./oportunidades.logic.js";

export * from "./oportunidades.logic.js";

/**
 * Oportunidades / Venta cruzada. Sugiere el complementario que le falta a cada cliente
 * a partir de la canasta (co-ocurrencia). Asume canasta multi-ítem de compra repetida.
 */
export const manifestOportunidades: AgentManifest = {
  id: "oportunidades",
  version: "0.1.0",
  nombre: "Oportunidades / Venta cruzada",
  descripcion: "Detecta venta cruzada por co-ocurrencia de productos en la canasta.",
  categoria: "clientes",
  requiereCapacidades: ["contacts", "catalog"],
  requiereTools: ["consultar_contactos", "consultar_catalogo", "consultar_transacciones"],
  modelosNegocio: ["transaccional_repetitivo"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteOportunidades: Agent = {
  manifest: manifestOportunidades,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const tx = providers.transactions;
    if (!tx?.paresComplementarios || !tx?.canastasPorContacto) {
      return { recomendaciones: [], resumen: "El adaptador no expone paresComplementarios/canastasPorContacto." };
    }

    const [pares, canastas] = await Promise.all([
      tx.paresComplementarios(ctx),
      tx.canastasPorContacto(ctx),
    ]);

    // Mapeo canónico → shapes de la lógica. Usamos el contactoId como clave estable
    // (la lógica solo lo trata como identificador), para poder trazar la recomendación.
    const paresLogic: ParComplementario[] = pares.map((p) => ({
      a: p.itemA, b: p.itemB, nombre_a: p.nombreA ?? null, nombre_b: p.nombreB ?? null, co: p.coOcurrencias,
    }));
    const clientes: ClienteProductos[] = canastas.items.map((c) => ({
      email: c.contactoId, nombre: c.nombre ?? c.contactoId, productos: c.itemIds,
    }));

    const oportunidades = detectarVentaCruzada(paresLogic, clientes);
    const recomendaciones: RecomendacionNueva[] = oportunidades.map((o) => ({
      agentId: manifestOportunidades.id,
      tipo: "venta_cruzada",
      titulo: `Ofrecer ${o.sugerido_nombre ?? o.sugerido} (compró ${o.tiene})`,
      descripcion: `Complementario frecuente (${o.co} co-ocurrencias).`,
      estado: "proposed",
      severidad: "oportunidad",
      confianza: o.confianza,
      prioridad: calcularPrioridad({ severidad: "oportunidad", confianza: o.confianza, valorEsperado: null }),
      refEntidad: { tipo: "contacto", id: o.email },
      dedupKey: `oportunidades:venta_cruzada:contacto:${o.email}:${o.sugerido}`,
      evidencia: { observado: { tiene: o.tiene, sugerido: o.sugerido, coOcurrencias: o.co } },
    }));

    return { recomendaciones, resumen: `${recomendaciones.length} oportunidad(es) de venta cruzada.` };
  },
};
