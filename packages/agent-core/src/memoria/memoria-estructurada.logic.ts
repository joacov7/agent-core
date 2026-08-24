// ─── Memoria estructurada: lógica pura (sin DB) ──────────────────────────────
// Portado de Regionales casi tal cual. Da estructura a memory_entries (NO crea otro
// sistema de memoria). Define los espacios formales y las reglas de vigencia/
// bloqueo de las decisiones.
//
// Nota: `DecisionValue` usa snake_case (`vigente_hasta`) porque refleja el valor
// guardado en la tabla; la reconciliación con el canónico camelCase de contracts
// (`DecisionValue.vigenteHasta`) es un follow-up del rename de naming.

export const MEM_NS = {
  EMPRESA: "empresa",
  CLIENTE: "cliente",
  PRODUCTO: "producto",
  PROVEEDOR: "proveedor",
  DECISION: "decision",
} as const;
export type MemNamespace = (typeof MEM_NS)[keyof typeof MEM_NS];

// Una decisión del usuario, trazable. `kind`:
//   'rechazo'     → bloquea una acción sobre una entidad mientras esté vigente.
//   'preferencia' → dato/regla informativa (no bloquea por sí sola).
export interface DecisionValue {
  actor: string;                 // quién la tomó
  cuando: string;                // ISO timestamp
  motivo?: string | null;        // por qué (si se indicó)
  contexto?: Record<string, any>;// contexto adicional
  accion?: string | null;        // acción a la que aplica (ej. 'aplicar_precio')
  entityType?: string | null;
  entityId?: string | null;
  vigente_hasta?: string | null; // ISO; null = permanente
}

// ¿La decisión sigue vigente en `now`? Sin vencimiento → permanente.
export function estaVigente(v: DecisionValue, now: Date = new Date()): boolean {
  if (!v.vigente_hasta) return true;
  return now.getTime() <= new Date(v.vigente_hasta).getTime();
}

// Clave estable de una decisión (para upsert/dedup por entidad+acción).
export function claveDecision(entityType: string | null | undefined, entityId: string | null | undefined, accion: string | null | undefined): string {
  return `decision:${entityType ?? "-"}:${entityId ?? "-"}:${accion ?? "-"}`;
}

// De una lista de decisiones (values), ¿hay alguna de tipo 'rechazo' vigente
// que bloquee `accion` sobre la entidad? Devuelve la que bloquea, o null.
export function decisionBloqueante(
  decisiones: { kind?: string | null; value: DecisionValue }[],
  accion: string,
  now: Date = new Date()
): DecisionValue | null {
  for (const d of decisiones) {
    if (d.kind !== "rechazo") continue;
    const v = d.value;
    if (v.accion && v.accion !== accion) continue;
    if (estaVigente(v, now)) return v;
  }
  return null;
}

// Fecha de vencimiento a partir de días de vigencia (null si no se pasa).
export function vencimientoEnDias(dias?: number | null, desde: Date = new Date()): string | null {
  if (dias == null || dias <= 0) return null;
  return new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();
}
