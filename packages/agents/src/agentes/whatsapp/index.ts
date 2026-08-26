import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva, Severidad,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { analizarConversacion, INTENCION_ALTA } from "./whatsapp-intel.logic.js";

export * from "./whatsapp-intel.logic.js";

/**
 * Comunicación / Atención (WhatsApp). Genérico: clasifica cada interacción pendiente
 * y estima intención de compra por reglas (determinístico). La IA queda para redactar
 * la respuesta (aún no wireada); acá solo prioriza qué atender primero.
 *
 * Nota de cadencia: la mecánica es genérica, pero la taxonomía de intención es
 * sales-flavored; en otro vertical el clasificador debería ser configurable.
 */
export const manifestWhatsapp: AgentManifest = {
  id: "whatsapp",
  version: "0.1.0",
  nombre: "Comunicación / Atención (WhatsApp)",
  descripcion: "Clasifica conversaciones pendientes y prioriza por intención de compra.",
  categoria: "comunicacion",
  requiereCapacidades: ["contacts"],
  requiereTools: ["consultar_interacciones"],
  nivelIA: "clasifica",
  costoEstimado: "cero",
  frecuenciaRecomendada: "evento",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "assisted",
};

export const agenteWhatsapp: Agent = {
  manifest: manifestWhatsapp,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const interactions = providers.interactions;
    if (!interactions) return { recomendaciones: [] };

    const pendientes = await interactions.pending(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const i of pendientes.items) {
      if (!i.texto) continue;
      const a = analizarConversacion(i.id, i.texto);

      const severidad: Severidad =
        a.tipo === "reclamo" ? "critica"
          : a.intencion >= INTENCION_ALTA ? "importante"
            : "oportunidad";
      const confianza = confianzaPorOrigen("inferencia_media"); // clasificación por reglas
      const prioridad = calcularPrioridad({ severidad, confianza, valorEsperado: null });

      recomendaciones.push({
        agentId: manifestWhatsapp.id,
        tipo: `atencion_${a.tipo}`,
        titulo: `Conversación de ${a.tipo} (intención ${a.intencion})`,
        descripcion: i.texto.slice(0, 240),
        estado: "proposed",
        severidad,
        confianza,
        origenConfianza: "inferencia_media",
        prioridad,
        refEntidad: { tipo: "contacto", id: i.contactoId },
        dedupKey: `whatsapp:contacto:${i.contactoId}:${a.tipo}`,
        accionTool: null,
        evidencia: {
          observado: { tipo: a.tipo, intencion: a.intencion },
          inferencia: "Clasificación e intención por reglas sobre el texto (sin IA).",
        },
      });
    }

    return {
      recomendaciones,
      resumen: `${recomendaciones.length} conversación(es) pendiente(s) clasificadas.`,
    };
  },
};
