import type { Recomendacion } from "@agent-core/contracts";

/**
 * Jefe de Gabinete (motor). STUB.
 * Migra `jefe-gabinete.logic.ts` casi tal cual: dedup → agrupa → detecta
 * conflictos → prioriza (100% determinístico) → selecciona top N → resume.
 * La IA, si existe, solo redacta el texto final; nunca decide prioridades.
 */
export function consolidar(recomendaciones: Recomendacion[]): Recomendacion[] {
  return recomendaciones;
}
