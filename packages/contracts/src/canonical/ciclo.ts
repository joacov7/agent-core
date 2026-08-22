import type { CanonicalEntity, EntityRef, ID, ISODateTime } from "../common.js";

/**
 * Artefactos del bucle Acción → Resultado → Impacto. La Recomendación lo inicia
 * (ver `recomendacion.ts`) y la Memoria lo cierra (ver `memoria.ts`).
 */

export type EstadoAccion =
  | "propuesta" | "aprobada" | "ejecutando" | "ejecutada" | "fallida" | "rechazada";

/** Acción concreta derivada de una recomendación: la invocación de una tool de escritura. */
export interface Accion extends CanonicalEntity {
  recomendacionId?: ID;
  toolId: string;
  params?: Record<string, unknown>;
  estado: EstadoAccion;
  actorId?: ID;
}

/**
 * Resultado de ejecutar una acción. Tabla del Core: `action_results`.
 * Separa SIEMPRE el resultado REAL (`valorReal` medido) del estimado de la reco.
 * `tipo` es la clasificación del resultado (configurable por vertical, ej.
 * "ejecutada"/"respondio"/"error"); no se hornea acá.
 */
export interface ResultadoAccion extends CanonicalEntity {
  accionId: ID;
  ok: boolean;
  tipo?: string;
  salida?: Record<string, unknown>;
  error?: string;
  /** Valor económico REAL medido (o null si no aplica / aún no se sabe). */
  valorReal?: number | null;
}

/** Impacto medido de una acción/recomendación (efecto posterior, comparable al estimado). */
export interface Impacto extends CanonicalEntity {
  recomendacionId?: ID;
  accionId?: ID;
  refEntidad?: EntityRef;
  metrica: string;
  valor: number;
  unidad?: string;
  medidoEn: ISODateTime;
}
