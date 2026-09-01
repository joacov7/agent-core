import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { evaluarEmpleado, type EmpleadoInput } from "./rrhh.logic.js";

export * from "./rrhh.logic.js";

/**
 * RRHH. Agenda los hitos de personal que requieren acción: fin de período de prueba
 * (confirmar/desvincular) y revisiones de desempeño. Genérico; requiere `staff`.
 */
export const manifestRrhh: AgentManifest = {
  id: "rrhh",
  version: "0.1.0",
  nombre: "RRHH",
  descripcion: "Avisa hitos de personal: fin de período de prueba y revisiones de desempeño por vencer.",
  categoria: "organizacion",
  requiereCapacidades: ["staff"],
  requiereTools: ["consultar_personal"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "medio",
  autonomiaMaxima: "manual",
};

export const agenteRrhh: Agent = {
  manifest: manifestRrhh,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    if (!providers.staff) return { recomendaciones: [], resumen: "Falta la capacidad staff." };

    const hoy = ctx.now?.() ?? new Date();
    const confianza = confianzaPorOrigen("deterministico");
    const { items } = await providers.staff.list(ctx);
    const recomendaciones: RecomendacionNueva[] = [];

    for (const e of items) {
      const input: EmpleadoInput = {
        id: e.id, nombre: e.nombre, estado: e.estado ?? null,
        finPeriodoPrueba: e.finPeriodoPrueba ?? null, proximaRevision: e.proximaRevision ?? null,
      };
      for (const a of evaluarEmpleado(input, hoy)) {
        recomendaciones.push({
          agentId: manifestRrhh.id,
          tipo: a.tipo,
          titulo: `${a.nombre}: ${a.motivo}`,
          descripcion: `Hito de RRHH para ${a.nombre}${e.rol ? ` (${e.rol})` : ""}.`,
          estado: "proposed",
          severidad: a.severidad,
          confianza,
          origenConfianza: "deterministico",
          prioridad: calcularPrioridad({ severidad: a.severidad, confianza, valorEsperado: null }),
          refEntidad: { tipo: "empleado", id: a.empleadoId },
          dedupKey: `rrhh:${a.tipo}:${a.empleadoId}`,
          evidencia: { observado: { tipo: a.tipo, diasHasta: a.diasHasta } },
        });
      }
    }

    return { recomendaciones, resumen: `${recomendaciones.length} hito(s) de personal a gestionar.` };
  },
};
