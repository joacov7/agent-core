// ─── Riesgo de abandono (churn): lógica pura (sin DB) ────────────────────────
// Detecta clientes que se pasaron de su frecuencia habitual de compra. Asume compra
// repetida (cadencia transaccional/suscripción). Determinístico: el riesgo sale del
// ratio recencia / frecuencia, no se infiere motivo.

import { leerCampos, type CamposAjuste } from "../../ajustes.js";

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

export const AJUSTES_CHURN: CamposAjuste<keyof UmbralesChurn> = {
  frecuenciaDefault: { titulo: "Frecuencia habitual", descripcion: "Cada cuántos días paga/compra un cliente cuando todavía no tiene una frecuencia propia.", default: 60, min: 1, max: 365, unidad: "días" },
  enRiesgo: { titulo: "En riesgo", descripcion: "Cuántas veces su frecuencia habitual lleva sin pagar/comprar para marcarlo \"en riesgo\". Subirlo reduce el ruido.", default: 1, min: 0.5, max: 20, entero: false, unidad: "x" },
  probable: { titulo: "Abandono probable", descripcion: "Veces su frecuencia habitual desde las que el abandono es probable. Si es menor que \"en riesgo\", se usa ese.", default: 1.5, min: 0.5, max: 20, entero: false, unidad: "x" },
  perdido: { titulo: "Dado por perdido", descripcion: "Veces su frecuencia habitual desde las que se da por perdido. Si es menor que \"probable\", se usa ese.", default: 3, min: 0.5, max: 50, entero: false, unidad: "x" },
  minCompras: { titulo: "Historia mínima", descripcion: "Cantidad mínima de pagos/compras para opinar sobre un cliente (con menos historia no se evalúa).", default: 2, min: 1, max: 50, unidad: "pagos" },
};

/** Los escalones siempre quedan ordenados (en riesgo ≤ probable ≤ perdido). */
export function umbralesChurnDeConfig(config?: Record<string, unknown>): UmbralesChurn {
  const v = leerCampos(AJUSTES_CHURN, config);
  const probable = Math.max(v.probable, v.enRiesgo);
  return { ...v, probable, perdido: Math.max(v.perdido, probable) };
}

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
