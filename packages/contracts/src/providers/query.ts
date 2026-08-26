/** Consulta de listado con paginación por cursor. El adaptador decide cómo aplica `q`. */
export interface ListQuery {
  limit?: number;
  cursor?: string;
  /** Filtro de texto libre (opcional). */
  q?: string;
}

/** Página de resultados. `nextCursor` ausente → no hay más. */
export interface Page<T> {
  items: T[];
  nextCursor?: string;
}
