// ─── Morosidad: lógica pura (sin DB) ─────────────────────────────────────────
// Clasifica el nivel de mora de un cobro vencido y sugiere la acción escalonada
// (recordatorio → aviso → llamado → gestión de incobrable). Determinístico.

export type NivelMora = "temprana" | "media" | "avanzada" | "incobrable_probable";
export type SeveridadMora = "critica" | "importante" | "oportunidad";

export interface UmbralesMora {
  media: number;       // días a partir de los cuales la mora es "media"
  avanzada: number;    // "avanzada"
  incobrable: number;  // riesgo de incobrable
}

export const UMBRALES_MORA_DEFAULT: UmbralesMora = { media: 30, avanzada: 60, incobrable: 90 };

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
