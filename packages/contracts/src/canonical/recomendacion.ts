import type { CanonicalEntity, EntityRef, ISODateTime } from "../common.js";

/**
 * Capa 1 — infraestructura universal. Intención/hallazgo del sistema y arranque del
 * bucle Recomendación → Acción → Resultado → Impacto → Memoria.
 *
 * El vocabulario (estados, severidad, confianza 0-100, prioridad 1-5, evidencia)
 * es el modelo real de `recommendations.logic` de Regionales: los tipos viven acá
 * (contracts) y las funciones puras (transiciones, prioridad, confianza, dedup)
 * viven en `agent-core/recommendations`.
 */

/** Máquina de estados de una recomendación. Las transiciones válidas viven en el Core. */
export type EstadoReco =
  | "new" | "analyzing" | "proposed" | "pending_approval" | "approved"
  | "executing" | "executed" | "failed" | "rejected" | "postponed"
  | "expired" | "cancelled";

/** Severidad: qué tan urgente es atender el hallazgo. */
export type Severidad = "critica" | "importante" | "oportunidad";

/**
 * Origen del dato que sustenta la confianza. La confianza NO se inventa: se deriva
 * del origen (el mapeo origen→número vive en el Core).
 */
export type OrigenConfianza =
  | "deterministico" | "calculo" | "inferencia_alta" | "inferencia_media"
  | "inferencia_baja" | "ia" | "incompleto";

/**
 * Evidencia estructurada: separa lo observado del cálculo, la inferencia y la
 * recomendación, para que una inferencia nunca se presente como un hecho.
 */
export interface Evidencia {
  observado?: Record<string, unknown>;
  calculo?: Record<string, unknown>;
  inferencia?: string;
  recomendacion?: string;
  fuentes?: { fuente: string; fecha?: string; url?: string }[];
}

/** Acción sugerida por una recomendación: apunta a una tool de escritura + params. */
export interface AccionSugerida {
  toolId: string;
  params?: Record<string, unknown>;
  etiqueta?: string;
}

export interface Recomendacion extends CanonicalEntity {
  agentId: string;
  tipo: string;
  titulo: string;
  descripcion?: string;

  estado: EstadoReco;
  severidad: Severidad;

  /** Confianza 0..100, derivada del origen del dato. */
  confianza: number;
  origenConfianza?: OrigenConfianza;

  /** Prioridad 1 (máxima) .. 5 (mínima). */
  prioridad: number;

  /** Impacto económico estimado (o null si no hay estimación). */
  impactoEstimado?: number | null;
  /** valor_esperado = impacto × probabilidad × margen (null si falta algún componente). */
  valorEsperado?: number | null;

  /** Entidad (Core o dominio) a la que apunta el hallazgo. */
  refEntidad?: EntityRef;
  /** Clave conservadora de agrupación (tipo+entidad). null → no dedup. */
  dedupKey?: string | null;

  /** Tool de escritura que ejecutaría la recomendación, si es accionable. */
  accionTool?: string | null;
  accionesSugeridas?: AccionSugerida[];

  evidencia?: Evidencia;
  expiraEn?: ISODateTime;
}
