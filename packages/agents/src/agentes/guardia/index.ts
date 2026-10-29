import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { evaluarGuardia } from "./guardia.logic.js";

export * from "./guardia.logic.js";

/**
 * Guardia de incidentes. Vigila que lo grave no quede sin atender: avisa cuando un incidente
 * (una alarma, una caída de red, un error) pasa los minutos que tolera su nivel sin que nadie lo
 * tome, o queda "en atención" demasiado tiempo. Solo avisa: no resuelve ni toca nada. Usa solo la
 * capacidad `incidents`, así sirve para cualquier rubro.
 */
export const manifestGuardia: AgentManifest = {
  id: "guardia",
  version: "0.1.0",
  nombre: "Guardia de incidentes",
  descripcion: "Vigila que los incidentes graves (pánico, intrusión, equipos caídos) no queden sin atender: avisa si pasan los minutos sin que nadie los tome.",
  categoria: "operaciones",
  requiereCapacidades: ["incidents"],
  requiereTools: ["consultar_incidentes"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "evento",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteGuardia: Agent = {
  manifest: manifestGuardia,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    if (!providers.incidents) return { recomendaciones: [], resumen: "Falta la capacidad incidents." };

    const ahora = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await providers.incidents.open(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const inc of items) {
      const a = evaluarGuardia(
        { id: inc.id, firma: inc.firma, titulo: inc.titulo, nivel: inc.nivel ?? null, estado: inc.estado ?? null, primeraVez: inc.primeraVez ?? null },
        ahora,
      );
      if (!a) continue;
      recomendaciones.push({
        agentId: manifestGuardia.id,
        tipo: a.tipo === "sin_atender" ? "incidente_sin_atender" : "incidente_atencion_lenta",
        titulo: `${inc.titulo}: ${a.texto}`,
        estado: "proposed",
        severidad: a.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: a.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "incidente", id: inc.id },
        // La clave NO incluye los minutos: el motor refresca el texto sin duplicar ni re-avisar.
        dedupKey: `guardia:${a.tipo}:${inc.firma}`,
        evidencia: { observado: { firma: inc.firma, nivel: inc.nivel ?? null, estado: inc.estado ?? null }, calculo: { minutos: a.minutos } },
      });
    }
    return { recomendaciones, resumen: `${recomendaciones.length} incidente(s) fuera de plazo de atención.` };
  },
};
