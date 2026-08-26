// ─── Ventas / Ofertas: lógica pura (sin DB) ──────────────────────────────────
// Prioriza oportunidades abiertas por valor esperado (valor × probabilidad) para
// empujarlas a cierre. Determinístico. Complementa a Seguimiento (que atiende las
// que quedaron sin cerrar); acá el foco es el valor a capturar.

export type SeveridadVenta = "importante" | "oportunidad";

export interface UmbralesVenta {
  /** Probabilidad por defecto cuando la oportunidad no la declara. */
  probabilidadDefault: number;
  /** Probabilidad a partir de la cual conviene empujar con prioridad. */
  umbralEmpuje: number;
}

export const UMBRALES_VENTA_DEFAULT: UmbralesVenta = { probabilidadDefault: 0.5, umbralEmpuje: 0.6 };

export interface AlertaVenta {
  severidad: SeveridadVenta;
  valorPonderado: number;
}

// Pondera valor × probabilidad. Null si no hay valor estimado positivo.
export function evaluarVenta(
  op: { valorEstimado?: number | null; probabilidad?: number | null },
  u: UmbralesVenta = UMBRALES_VENTA_DEFAULT,
): AlertaVenta | null {
  if (op.valorEstimado == null || op.valorEstimado <= 0) return null;
  const prob = op.probabilidad ?? u.probabilidadDefault;
  const valorPonderado = Math.round(op.valorEstimado * prob);
  const severidad: SeveridadVenta = prob >= u.umbralEmpuje ? "importante" : "oportunidad";
  return { severidad, valorPonderado };
}
