// ─── Morosidad: lógica pura (sin DB) ─────────────────────────────────────────
// Clasifica el nivel de mora de un cobro vencido y sugiere la acción escalonada
// (recordatorio → aviso → llamado → gestión de incobrable). Determinístico.

import { leerCampos, type CamposAjuste } from "../../ajustes.js";

export type NivelMora = "temprana" | "media" | "avanzada" | "incobrable_probable";
export type SeveridadMora = "critica" | "importante" | "oportunidad";

export interface UmbralesMora {
  media: number;       // días a partir de los cuales la mora es "media"
  avanzada: number;    // "avanzada"
  incobrable: number;  // riesgo de incobrable
}

export const UMBRALES_MORA_DEFAULT: UmbralesMora = { media: 30, avanzada: 60, incobrable: 90 };

export const AJUSTES_MORA: CamposAjuste<keyof UmbralesMora> = {
  media: { titulo: "Mora media", descripcion: "Días de atraso desde los que la mora es \"media\" (segundo aviso).", default: 30, min: 1, max: 365, unidad: "días" },
  avanzada: { titulo: "Mora avanzada", descripcion: "Días desde los que es \"avanzada\" (llamado y plan de pago). Si es menor que la media, se usa la media.", default: 60, min: 1, max: 730, unidad: "días" },
  incobrable: { titulo: "Riesgo de incobrable", descripcion: "Días desde los que se considera probable incobrable. Si es menor que la avanzada, se usa la avanzada.", default: 90, min: 1, max: 1095, unidad: "días" },
};

/** Los escalones siempre quedan ordenados (media ≤ avanzada ≤ incobrable), aunque la config venga cruzada. */
export function umbralesMoraDeConfig(config?: Record<string, unknown>): UmbralesMora {
  const v = leerCampos(AJUSTES_MORA, config);
  const avanzada = Math.max(v.avanzada, v.media);
  return { media: v.media, avanzada, incobrable: Math.max(v.incobrable, avanzada) };
}

export interface AlertaMora {
  nivel: NivelMora;
  severidad: SeveridadMora;
  /** Acción sugerida según el escalón. */
  accion: string;
}

const ACCION: Record<NivelMora, string> = {
  temprana: "enviar recordatorio",
  media: "segundo aviso / contactar",
  avanzada: "llamado y plan de pago",
  incobrable_probable: "gestión de cobranza y previsión de incobrable",
};

const SEVERIDAD: Record<NivelMora, SeveridadMora> = {
  temprana: "oportunidad",
  media: "importante",
  avanzada: "importante",
  incobrable_probable: "critica",
};

// Clasifica la mora por días vencido. Null si el cobro no está vencido (dias <= 0).
export function clasificarMora(
  diasVencido: number, u: UmbralesMora = UMBRALES_MORA_DEFAULT,
): AlertaMora | null {
  if (diasVencido <= 0) return null;
  const nivel: NivelMora =
    diasVencido >= u.incobrable ? "incobrable_probable"
      : diasVencido >= u.avanzada ? "avanzada"
        : diasVencido >= u.media ? "media"
          : "temprana";
  return { nivel, severidad: SEVERIDAD[nivel], accion: ACCION[nivel] };
}
