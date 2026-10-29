import type { Agent, AgentContext, AgentManifest, AgentRunOutput } from "@agent-core/contracts";
import { componerResumen } from "./resumen.logic.js";
import { personaDe } from "../../personas.js";
import { catalogoRoles } from "./roles.js";

export * from "./resumen.logic.js";

/**
 * Asistente personal (proactivo). Es el interruptor de los avisos: encendido, el programador de la
 * app le manda a la persona el **resumen de la mañana** y las **alertas urgentes** (por Telegram u
 * otro canal); apagado, no escribe nada. SOLO AVISA: no ejecuta acciones ni toca ningún sistema.
 * Su `run()` no crea recomendaciones: deja el resumen del día (leído del CoreStore, como el Jefe).
 */
export const manifestAsistente: AgentManifest = {
  id: "asistente",
  version: "0.1.0",
  nombre: "Asistente personal",
  descripcion: "Te escribe cada mañana con lo importante y te avisa al instante si pasa algo grave. Solo avisa: no actúa.",
  categoria: "direccion",
  requiereCapacidades: [],
  requiereTools: ["consultar_recomendaciones"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteAsistente: Agent = {
  manifest: manifestAsistente,
  async run({ ctx, store }: AgentContext): Promise<AgentRunOutput> {
    const { items } = await store.recommendations.list(ctx);
    const nombres: Record<string, string> = {};
    for (const id of new Set(items.map((r) => r.agentId))) nombres[id] = personaDe(id).nombre;
    const fecha = (ctx.now?.() ?? new Date()).toISOString().slice(0, 10);
    return { recomendaciones: [], resumen: componerResumen(items, { fecha, nombres, roles: catalogoRoles() }) };
  },
};
