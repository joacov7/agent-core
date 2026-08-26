// ─── Competencia: lógica pura (sin DB) ───────────────────────────────────────
// Compara nuestro precio contra la evidencia de mercado y ubica el ítem: por
// encima, en línea o por debajo. Determinístico.

export type Posicion = "por_encima" | "en_linea" | "por_debajo";
export type SeveridadCompetencia = "importante" | "oportunidad";

export interface UmbralesCompetencia {
  /** Tolerancia (%) dentro de la cual se considera "en línea" con el mercado. */
  toleranciaPct: number;
}

export const UMBRALES_COMPETENCIA_DEFAULT: UmbralesCompetencia = { toleranciaPct: 5 };

export interface AlertaCompetencia {
  posicion: Posicion;
  gapPct: number;
  severidad: SeveridadCompetencia;
}

// Ubica el ítem vs mercado. Null si está en línea (dentro de la tolerancia) o si
// falta algún precio. `por_encima` (caros) es importante; `por_debajo` es oportunidad.
export function posicionMercado(
  nuestroPrecio: number, precioMercado: number, u: UmbralesCompetencia = UMBRALES_COMPETENCIA_DEFAULT,
): AlertaCompetencia | null {
  if (!(precioMercado > 0)) return null;
  const gapPct = Math.round(((nuestroPrecio - precioMercado) / precioMercado) * 1000) / 10;
  if (Math.abs(gapPct) <= u.toleranciaPct) return null;
  return gapPct > 0
    ? { posicion: "por_encima", gapPct, severidad: "importante" }
    : { posicion: "por_debajo", gapPct, severidad: "oportunidad" };
}
