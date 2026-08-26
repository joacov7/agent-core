import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, Recomendacion,
} from "@agent-core/contracts";
import { analizar, type RecoJefe } from "@agent-core/core";

/**
 * Jefe de Gabinete. Dedup, agrupa, detecta conflictos, prioriza y resume las
 * recomendaciones ya generadas (leídas del CoreStore) usando la lógica del Core.
 * No crea recomendaciones nuevas: produce el resumen priorizado del día.
 */
export const manifestJefeGabinete: AgentManifest = {
  id: "jefe",
  version: "0.1.0",
  nombre: "Jefe de Gabinete",
  descripcion: "Dedup, prioriza y resume las recomendaciones del día.",
  categoria: "direccion",
  requiereCapacidades: [],
  requiereTools: ["consultar_recomendaciones"],
  nivelIA: "redacta",
  costoEstimado: "bajo",
  frecuenciaRecomendada: "diaria",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

// Recomendacion canónica (camelCase) → RecoJefe (DTO snake_case de la lógica del Core).
function aRecoJefe(r: Recomendacion, indice: number): RecoJefe {
  return {
    id: indice,
    agent_id: r.agentId,
    tipo: r.tipo,
    titulo: r.titulo,
    descripcion: r.descripcion ?? null,
    prioridad: r.prioridad,
    severidad: r.severidad,
    impacto_estimado: r.impactoEstimado ?? null,
    valor_esperado: r.valorEsperado ?? null,
    confianza: r.confianza,
    estado: r.estado,
    entity_type: r.refEntidad?.tipo ?? null,
    entity_id: r.refEntidad?.id ?? null,
    action_tool: r.accionTool ?? null,
    dedup_key: r.dedupKey ?? null,
    metadata: {},
    agentes: [r.agentId],
  };
}

export const agenteJefeGabinete: Agent = {
  manifest: manifestJefeGabinete,
  async run({ ctx, store }: AgentContext): Promise<AgentRunOutput> {
    const { items } = await store.recommendations.list(ctx);
    const analisis = analizar(items.map(aRecoJefe));
    return { recomendaciones: [], resumen: analisis.textoPlantilla };
  },
};
