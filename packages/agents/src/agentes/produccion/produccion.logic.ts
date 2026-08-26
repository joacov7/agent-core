// ─── Producción / Mantenimiento: lógica pura (sin DB) ────────────────────────
// Clasifica un proceso productivo (modelado como Tarea) por demora/parada o por
// vencer. Determinístico.

export type SeveridadProceso = "critica" | "importante";

export interface AlertaProceso {
  severidad: SeveridadProceso;
  diasHasta: number;
  motivo: string;
}

const ESTADOS_CERRADOS = new Set(["completada", "cancelada"]);

// Evalúa un proceso abierto. Null si está cerrado, sin fecha, o lejos de vencer.
export function evaluarProceso(
  p: { estado: string; venceEn?: string }, hoy: Date,
): AlertaProceso | null {
  if (ESTADOS_CERRADOS.has(p.estado)) return null;
  if (!p.venceEn) return null;
  const dias = Math.floor((new Date(p.venceEn).getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
  if (dias < 0) return { severidad: "critica", diasHasta: dias, motivo: `demorado/parado hace ${-dias} día(s)` };
  if (dias <= 1) return { severidad: "importante", diasHasta: dias, motivo: `vence en ${dias} día(s)` };
  return null;
}
