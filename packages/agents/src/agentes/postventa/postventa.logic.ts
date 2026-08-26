// ─── Postventa / Recompra: lógica pura (sin DB) ──────────────────────────────
// A partir de la recencia y la frecuencia de compra decide si pedir una reseña
// (compra reciente) o proponer la recompra (ventana del próximo ciclo). Asume compra
// repetida. Determinístico. La ventana de recompra queda ANTES del churn.

export type TipoPostventa = "resena" | "recompra";
export type SeveridadPostventa = "importante" | "oportunidad";

export interface UmbralesPostventa {
  /** Días tras la compra dentro de los cuales pedir reseña. */
  ventanaResenaDias: number;
  /** Ventana de recompra como fracción de la frecuencia habitual [desde, hasta]. */
  recompraDesde: number;
  recompraHasta: number;
}

export const UMBRALES_POSTVENTA_DEFAULT: UmbralesPostventa = {
  ventanaResenaDias: 7, recompraDesde: 0.8, recompraHasta: 1.2,
};

export interface AlertaPostventa {
  tipo: TipoPostventa;
  severidad: SeveridadPostventa;
  motivo: string;
}

export interface ClientePostventa {
  compras: number;
  diasDesdeUltima: number;
  frecuenciaDias?: number | null;
}

// Reseña si la compra es reciente; recompra si está en la ventana del próximo ciclo.
// Null si no compró nunca o está fuera de ambas ventanas (p. ej. ya es churn).
export function evaluarPostventa(
  c: ClientePostventa, u: UmbralesPostventa = UMBRALES_POSTVENTA_DEFAULT,
): AlertaPostventa | null {
  if (c.compras < 1) return null;
  if (c.diasDesdeUltima >= 0 && c.diasDesdeUltima <= u.ventanaResenaDias) {
    return { tipo: "resena", severidad: "oportunidad", motivo: `compra reciente (${c.diasDesdeUltima}d): pedir reseña` };
  }
  const f = c.frecuenciaDias;
  if (f != null && f > 0 && c.diasDesdeUltima >= u.recompraDesde * f && c.diasDesdeUltima <= u.recompraHasta * f) {
    return { tipo: "recompra", severidad: "importante", motivo: `en ventana de recompra (~${f}d)` };
  }
  return null;
}
