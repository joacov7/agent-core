// ─── Agenda / Vencimientos: lógica pura (sin DB) ─────────────────────────────
// Clasifica un evento por su proximidad (o si ya venció). Determinístico.

export type SeveridadAgenda = "critica" | "importante" | "oportunidad";

export interface UmbralesAgenda {
  /** Días de anticipación para marcar "importante". */
  diasProximo: number;
  /** Días de anticipación para marcar "oportunidad" (aviso temprano). */
  diasAviso: number;
}

export const UMBRALES_AGENDA_DEFAULT: UmbralesAgenda = { diasProximo: 2, diasAviso: 7 };

export interface AlertaAgenda {
  severidad: SeveridadAgenda;
  diasHasta: number;
  motivo: string;
}

/** Días hasta el evento (negativo si ya pasó). */
export function diasHasta(inicia: string, hoy: Date): number {
  const ms = new Date(inicia).getTime() - hoy.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// Clasifica un evento por proximidad. Null si está demasiado lejos (> diasAviso).
export function clasificarEvento(
  inicia: string, hoy: Date, u: UmbralesAgenda = UMBRALES_AGENDA_DEFAULT,
): AlertaAgenda | null {
  const dias = diasHasta(inicia, hoy);
  if (dias < 0) return { severidad: "critica", diasHasta: dias, motivo: `vencido hace ${-dias} día(s)` };
  if (dias <= u.diasProximo) return { severidad: "importante", diasHasta: dias, motivo: `en ${dias} día(s)` };
  if (dias <= u.diasAviso) return { severidad: "oportunidad", diasHasta: dias, motivo: `en ${dias} día(s)` };
  return null;
}
