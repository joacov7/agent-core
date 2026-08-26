// ─── Logística: lógica pura (sin DB) ─────────────────────────────────────────
// Clasifica una entrega (modelada como Tarea) por demora o inminencia. Determinístico.

export type SeveridadEntrega = "critica" | "importante";

export interface AlertaEntrega {
  severidad: SeveridadEntrega;
  diasHasta: number;
  motivo: string;
}

const ESTADOS_CERRADOS = new Set(["completada", "cancelada"]);

// Evalúa una entrega abierta. Null si ya está cerrada, no tiene fecha, o falta mucho.
export function evaluarEntrega(
  e: { estado: string; venceEn?: string }, hoy: Date,
): AlertaEntrega | null {
  if (ESTADOS_CERRADOS.has(e.estado)) return null;
  if (!e.venceEn) return null;
  const dias = Math.floor((new Date(e.venceEn).getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
  if (dias < 0) return { severidad: "critica", diasHasta: dias, motivo: `demorada hace ${-dias} día(s)` };
  if (dias <= 1) return { severidad: "importante", diasHasta: dias, motivo: `entrega en ${dias} día(s)` };
  return null;
}
