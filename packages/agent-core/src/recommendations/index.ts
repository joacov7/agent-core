import type { Recomendacion } from "@agent-core/contracts";

/**
 * Recommendations (motor). STUB.
 * Aquí van los .logic puros de Regionales (transiciones de estado, severidad,
 * confianza por origen, valor esperado, prioridad, dedupKey), que migran casi
 * tal cual desde `recommendations.logic.ts`.
 */

/** Ordena por prioridad ascendente (1 = máxima). Placeholder del futuro `priorizar`. */
export function ordenarPorPrioridad(recos: Recomendacion[]): Recomendacion[] {
  return [...recos].sort((a, b) => a.prioridad - b.prioridad);
}
