import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { priorizarIncidentes, type IncidenteInput } from "./sistemas.logic.js";

export * from "./sistemas.logic.js";

/**
 * Sistemas / Triage de incidentes. Prioriza los incidentes de software abiertos
 * (severidad × frecuencia × usuarios × recencia × entorno) y recomienda cuál atacar
 * primero. Determinístico y de solo lectura: NO corrige código ni propone parches
 * (eso será una acción gateada por enforcement en una entrega posterior).
 */
export const manifestSistemas: AgentManifest = {
  id: "sistemas",
  version: "0.1.0",
  nombre: "Sistemas / Triage de incidentes",
  descripcion: "Prioriza los incidentes de software abiertos para decidir cuál corregir primero.",
  categoria: "operaciones",
  requiereCapacidades: ["incidents"],
  requiereTools: ["consultar_incidentes"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteSistemas: Agent = {
  manifest: manifestSistemas,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    if (!providers.incidents) return { recomendaciones: [], resumen: "Falta la capacidad incidents." };

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await providers.incidents.open(ctx);

    const entrada: IncidenteInput[] = items.map((i) => ({
      id: i.id,
      firma: i.firma,
      titulo: i.titulo,
      servicio: i.servicio ?? null,
      entorno: i.entorno ?? null,
      nivel: i.nivel ?? null,
      ocurrencias: i.ocurrencias,
      usuariosAfectados: i.usuariosAfectados ?? null,
      ultimaVez: i.ultimaVez ?? null,
      estado: i.estado ?? null,
    }));

    const priorizados = priorizarIncidentes(entrada, hoy);
    const recomendaciones: RecomendacionNueva[] = priorizados.map((p) => ({
      agentId: manifestSistemas.id,
      tipo: "incidente",
      titulo: `${p.servicio ? `[${p.servicio}] ` : ""}${p.titulo}`,
      descripcion: `Triage (score ${p.score}): ${p.motivo}.`,
      estado: "proposed",
      severidad: p.severidad,
      confianza,
      origenConfianza: "deterministico",
      prioridad: calcularPrioridad({ severidad: p.severidad, confianza, valorEsperado: null }),
      refEntidad: { tipo: "incidente", id: p.id },
      dedupKey: `sistemas:incidente:${p.firma}`,
      evidencia: { observado: { firma: p.firma, score: p.score, servicio: p.servicio } },
    }));

    return { recomendaciones, resumen: `${recomendaciones.length} incidente(s) priorizado(s) para triage.` };
  },
};
