// ─── Seguimiento: lógica pura (sin DB) ───────────────────────────────────────
// "Lo que quedó sin cerrar": marca oportunidades abiertas que necesitan un empujón
// (cierre estimado vencido, sin próximo paso, o por cerrar pronto). Determinístico.

export type SeveridadSeguimiento = "critica" | "importante" | "oportunidad";

export interface UmbralesSeguimiento {
  /** Días de anticipación para marcar "por cerrar". */
  diasPorCerrar: number;
}

export const UMBRALES_SEGUIMIENTO_DEFAULT: UmbralesSeguimiento = { diasPorCerrar: 7 };

export interface AlertaSeguimiento {
  severidad: SeveridadSeguimiento;
  motivo: string;
}

// Evalúa una oportunidad abierta. Null si tiene cierre estimado cómodo en el futuro.
export function evaluarSeguimiento(
  op: { cierreEstimado?: string }, hoy: Date, u: UmbralesSeguimiento = UMBRALES_SEGUIMIENTO_DEFAULT,
): AlertaSeguimiento | null {
  if (!op.cierreEstimado) {
    return { severidad: "oportunidad", motivo: "sin próximo paso definido" };
  }
  const dias = Math.floor((new Date(op.cierreEstimado).getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
  if (dias < 0) return { severidad: "importante", motivo: `cierre estimado vencido hace ${-dias} día(s)` };
  if (dias <= u.diasPorCerrar) return { severidad: "importante", motivo: `por cerrar en ${dias} día(s)` };
  return null;
}
