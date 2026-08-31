import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import {
  esObligacion, estaRespaldada, clasificarObligacion,
  type ObligacionInput, type RespaldoDoc,
} from "./compliance.logic.js";

export * from "./compliance.logic.js";

/**
 * Compliance. Cruza las obligaciones de la agenda (vencimientos regulatorios/legales)
 * contra si tienen un documento de respaldo; la falta de respaldo escala la severidad.
 * Genérico: la noción de "obligación" sale del tipo del evento, no del rubro.
 */
export const manifestCompliance: AgentManifest = {
  id: "compliance",
  version: "0.1.0",
  nombre: "Compliance",
  descripcion: "Vigila obligaciones regulatorias por vencer y alerta cuando les falta documento de respaldo.",
  categoria: "organizacion",
  requiereCapacidades: ["agenda", "documents"],
  requiereTools: ["consultar_agenda", "consultar_documentos"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

/** Días hasta una fecha ISO respecto de `hoy` (negativo si ya pasó). */
function diasHasta(inicia: string, hoy: Date): number {
  return Math.floor((new Date(inicia).getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

export const agenteCompliance: Agent = {
  manifest: manifestCompliance,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    if (!providers.agenda || !providers.documents) {
      return { recomendaciones: [], resumen: "Faltan capacidades agenda/documents." };
    }

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const [eventos, documentos] = await Promise.all([
      providers.agenda.upcoming(ctx),
      providers.documents.list(ctx),
    ]);

    const docs: RespaldoDoc[] = documentos.items.map((d) => ({ refEntidadId: d.refEntidad?.id ?? null }));
    const recomendaciones: RecomendacionNueva[] = [];

    for (const ev of eventos.items) {
      if (!esObligacion(ev.tipo)) continue;
      const ob: ObligacionInput = {
        id: ev.id, tipo: ev.tipo, titulo: ev.titulo,
        diasHasta: diasHasta(ev.inicia, hoy), refEntidadId: ev.refEntidad?.id ?? null,
      };
      const respaldada = estaRespaldada(ob, docs);
      const alerta = clasificarObligacion(ob.diasHasta, respaldada);
      if (!alerta) continue;

      recomendaciones.push({
        agentId: manifestCompliance.id,
        tipo: "compliance",
        titulo: `${ev.titulo} — ${alerta.motivo}`,
        descripcion: `Obligación "${ev.tipo}"${respaldada ? " con respaldo documental" : " sin documento de respaldo"}.`,
        estado: "proposed",
        severidad: alerta.severidad,
        confianza,
        origenConfianza: "deterministico",
        prioridad: calcularPrioridad({ severidad: alerta.severidad, confianza, valorEsperado: null }),
        refEntidad: { tipo: "evento", id: ev.id },
        dedupKey: `compliance:${ev.id}`,
        evidencia: { observado: { tipo: ev.tipo, diasHasta: ob.diasHasta, respaldada } },
      });
    }

    return { recomendaciones, resumen: `${recomendaciones.length} obligación(es) a vigilar.` };
  },
};
