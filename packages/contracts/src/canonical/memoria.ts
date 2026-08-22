import type { CanonicalEntity, ID, ISODateTime } from "../common.js";

/**
 * Memoria estructurada: da forma a la tabla `memory_entries` del Core (no es otro
 * sistema de memoria). Cierra el bucle: lo aprendido de resultados/impacto queda
 * disponible para próximas corridas.
 */

/**
 * Espacios formales de memoria. Se modela como `string` (extensible por vertical),
 * con los namespaces estándar documentados aquí:
 *   "empresa" | "cliente" | "decision"  → universales
 *   otros (ej. "producto", "proveedor") → los agrega la app según su rubro.
 */
export type MemNamespace = string;

/**
 * Una decisión del usuario, trazable. Un "rechazo" vigente BLOQUEA una acción sobre
 * una entidad; una "preferencia" es informativa. El enforcement la consulta.
 */
export interface DecisionValue {
  actor: string;
  cuando: ISODateTime;
  motivo?: string | null;
  contexto?: Record<string, unknown>;
  accion?: string | null;
  entityType?: string | null;
  entityId?: ID | null;
  /** ISO; null = permanente. */
  vigenteHasta?: ISODateTime | null;
}

/** Entrada de memoria estructurada. Tabla del Core: `memory_entries`. */
export interface EntradaMemoria extends CanonicalEntity {
  namespace: MemNamespace;
  clave: string;
  /** 'rechazo' | 'preferencia' | libre según namespace. */
  kind?: string | null;
  contenido: Record<string, unknown>;
  agentId?: string;
  expiraEn?: ISODateTime | null;
}
