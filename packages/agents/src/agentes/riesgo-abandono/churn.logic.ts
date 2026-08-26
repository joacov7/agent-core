// ─── Riesgo de abandono (churn): lógica pura (sin DB) ────────────────────────
// Detecta clientes que se pasaron de su frecuencia habitual de compra. Asume compra
// repetida (cadencia transaccional/suscripción). Determinístico: el riesgo sale del
// ratio recencia / frecuencia, no se infiere motivo.

export type NivelChurn = "en_riesgo" | "probable" | "perdido";
export type SeveridadChurn = "critica" | "importante" | "oportunidad";

export interface UmbralesChurn {
  /** Frecuencia por defecto (días) cuando el cliente no tiene una establecida. */
  frecuenciaDefault: number;
  /** Ratio recencia/frecuencia a partir del cual hay riesgo / es probable / se da por perdido. */
  enRiesgo: number;
  probable: number;
  perdido: number;
  /** Compras mínimas para poder evaluar churn (menos historia → no se opina). */
  minCompras: number;
}

export const UMBRALES_CHURN_DEFAULT: UmbralesChurn = {
  frecuenciaDefault: 60, enRiesgo: 1, probable: 1.5, perdido: 3, minCompras: 2,
};

export interface AlertaChurn {
  nivel: NivelChurn;
  severidad: SeveridadChurn;
  ratio: number;
}

const SEVERIDAD: Record<NivelChurn, SeveridadChurn> = {
  en_riesgo: "oportunidad",
  probable: "importante",
  perdido: "importante",
};

export interface ClienteChurn {
  compras: number;
  diasDesdeUltima: number;
  frecuenciaDias?: number | null;
}

// Evalúa el riesgo de abandono. Null si no hay historia suficiente o el cliente
// está dentro de su frecuencia habitual (ratio < enRiesgo).
export function evaluarChurn(
  c: ClienteChurn, u: UmbralesChurn = UMBRALES_CHURN_DEFAULT,
): AlertaChurn | null {
  if (c.compras < u.minCompras) return null;
  const frecuencia = c.frecuenciaDias ?? u.frecuenciaDefault;
  if (frecuencia <= 0) return null;
  const ratio = Math.round((c.diasDesdeUltima / frecuencia) * 100) / 100;
  if (ratio < u.enRiesgo) return null;
  const nivel: NivelChurn =
    ratio >= u.perdido ? "perdido" : ratio >= u.probable ? "probable" : "en_riesgo";
  return { nivel, severidad: SEVERIDAD[nivel], ratio };
}
