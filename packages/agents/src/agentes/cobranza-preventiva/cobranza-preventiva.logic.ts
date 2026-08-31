// ─── Cobranza preventiva: lógica pura (sin DB) ───────────────────────────────
// Avisa ANTES de que venza un cobro (recordatorio anticipado), para no llegar a la
// mora. Determinístico. Complementa a Cobros (ya vencido) y Morosidad (mora
// avanzada): esto es solo lo que está POR vencer dentro de una ventana.

export type SeveridadPreventiva = "importante" | "oportunidad";

export interface UmbralesPreventivo {
  /** Días de anticipación para marcar "importante" (vence pronto). */
  diasProximo: number;
  /** Días de anticipación para empezar a avisar (aviso temprano). */
  diasAviso: number;
  /** Monto mínimo para ameritar aviso (evita ruido de centavos). */
  montoRelevante: number;
}

export const UMBRALES_PREVENTIVO_DEFAULT: UmbralesPreventivo = {
  diasProximo: 3, diasAviso: 7, montoRelevante: 0,
};

export interface CobroPreventivoInput {
  estado: string;
  monto: number;
  /** Días hasta el vencimiento: > 0 aún no vence, <= 0 ya vencido. */
  diasHastaVencimiento: number;
}

export interface AlertaPreventiva {
  severidad: SeveridadPreventiva;
  motivo: string;
}

/** Días hasta el vencimiento respecto de `hoy` (null si no tiene vencimiento). */
export function diasHastaVencimiento(venceEn: string | undefined, hoy: Date): number | null {
  if (!venceEn) return null;
  const ms = new Date(venceEn).getTime() - hoy.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// Clasifica un cobro por vencer. Null si no amerita aviso preventivo: ya cobrado/
// incobrable, monto irrelevante, ya vencido (eso es de Cobros) o todavía muy lejos.
export function clasificarPreventivo(
  c: CobroPreventivoInput, u: UmbralesPreventivo = UMBRALES_PREVENTIVO_DEFAULT,
): AlertaPreventiva | null {
  if (c.estado === "cobrado" || c.estado === "incobrable") return null;
  if (c.monto <= u.montoRelevante) return null;
  if (c.diasHastaVencimiento < 0) return null;        // ya vencido → no es preventivo
  if (c.diasHastaVencimiento > u.diasAviso) return null; // todavía muy lejos
  const severidad: SeveridadPreventiva =
    c.diasHastaVencimiento <= u.diasProximo ? "importante" : "oportunidad";
  const cuando = c.diasHastaVencimiento === 0 ? "hoy" : `en ${c.diasHastaVencimiento} día(s)`;
  return { severidad, motivo: `vence ${cuando}` };
}
