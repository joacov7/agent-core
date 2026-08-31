// ─── Compliance: lógica pura (sin DB) ────────────────────────────────────────
// Cruza obligaciones (vencimientos regulatorios de la agenda) contra si tienen un
// documento de respaldo. Determinístico: la falta de respaldo escala la severidad.
// No asume rubro: "obligación" se detecta por el tipo del evento (impuesto, plazo,
// presentación, licencia…), configurable.

export type SeveridadCompliance = "critica" | "importante" | "oportunidad";

export interface UmbralesCompliance {
  /** Días de anticipación para marcar la obligación como próxima. */
  diasProximo: number;
  /** Días de anticipación para empezar a avisar. */
  diasAviso: number;
}

export const UMBRALES_COMPLIANCE_DEFAULT: UmbralesCompliance = { diasProximo: 5, diasAviso: 15 };

// Tipos de evento que representan una obligación regulatoria/legal. Se comparan
// normalizados y por inclusión (así "vencimiento_afip" matchea "vencimiento").
export const TIPOS_OBLIGACION_DEFAULT: readonly string[] = [
  "vencimiento", "obligacion", "regulatorio", "impuesto", "fiscal",
  "presentacion", "plazo", "declaracion", "licencia", "habilitacion", "audiencia",
];

export interface ObligacionInput {
  id: string;
  tipo: string;
  titulo: string;
  /** Días hasta la obligación: > 0 futuro, <= 0 ya vencida. */
  diasHasta: number;
  /** A qué entidad apunta la obligación (expediente, contacto…), o null. */
  refEntidadId: string | null;
}

/** Respaldo documental: a qué apunta cada documento disponible. */
export interface RespaldoDoc {
  /** id de la entidad a la que apunta el documento (evento u otra), o null. */
  refEntidadId: string | null;
}

export interface AlertaCompliance {
  severidad: SeveridadCompliance;
  motivo: string;
  respaldada: boolean;
}

function normalizar(s: string): string {
  return s.trim().toLowerCase();
}

/** ¿El tipo de evento representa una obligación? (inclusión sobre la lista). */
export function esObligacion(
  tipo: string, tipos: readonly string[] = TIPOS_OBLIGACION_DEFAULT,
): boolean {
  const t = normalizar(tipo);
  return tipos.some((k) => t.includes(normalizar(k)));
}

/** ¿La obligación tiene un documento de respaldo? (doc que apunta al evento o a su entidad). */
export function estaRespaldada(ob: ObligacionInput, docs: RespaldoDoc[]): boolean {
  return docs.some((d) =>
    d.refEntidadId != null &&
    (d.refEntidadId === ob.id || (ob.refEntidadId != null && d.refEntidadId === ob.refEntidadId)),
  );
}

// Clasifica una obligación por proximidad y respaldo. Null si está demasiado lejos.
export function clasificarObligacion(
  dias: number, respaldada: boolean, u: UmbralesCompliance = UMBRALES_COMPLIANCE_DEFAULT,
): AlertaCompliance | null {
  if (dias > u.diasAviso) return null;

  if (dias < 0) {
    return respaldada
      ? { severidad: "importante", motivo: `vencida hace ${-dias} día(s) — verificar presentación`, respaldada }
      : { severidad: "critica", motivo: `vencida hace ${-dias} día(s) sin respaldo`, respaldada };
  }
  const cuando = dias === 0 ? "vence hoy" : `vence en ${dias} día(s)`;
  if (dias <= u.diasProximo) {
    return respaldada
      ? { severidad: "importante", motivo: `${cuando} (con respaldo)`, respaldada }
      : { severidad: "critica", motivo: `${cuando} sin respaldo`, respaldada };
  }
  return respaldada
    ? { severidad: "oportunidad", motivo: `${cuando} (con respaldo)`, respaldada }
    : { severidad: "importante", motivo: `${cuando} sin respaldo`, respaldada };
}
