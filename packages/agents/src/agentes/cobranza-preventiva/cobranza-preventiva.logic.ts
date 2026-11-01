// ─── Cobranza preventiva: lógica pura (sin DB) ───────────────────────────────
// Avisa ANTES de que venza un cobro (recordatorio anticipado), para no llegar a la
// mora. Determinístico. Complementa a Cobros (ya vencido) y Morosidad (mora
// avanzada): esto es solo lo que está POR vencer dentro de una ventana.

import { leerCampos, type CamposAjuste } from "../../ajustes.js";

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

export const AJUSTES_PREVENTIVO: CamposAjuste<keyof UmbralesPreventivo> = {
  diasProximo: { titulo: "Vence pronto", descripcion: "Días antes del vencimiento desde los que el recordatorio es \"importante\".", default: 3, min: 0, max: 90, unidad: "días" },
  diasAviso: { titulo: "Aviso temprano", descripcion: "Días antes del vencimiento desde los que se empieza a recordar. Si es menor que \"vence pronto\", se usa ese.", default: 7, min: 0, max: 180, unidad: "días" },
  montoRelevante: { titulo: "Monto mínimo", descripcion: "Los cobros por este monto o menos no generan recordatorio.", default: 0, min: 0, max: 1_000_000_000, entero: false },
};

export function umbralesPreventivoDeConfig(config?: Record<string, unknown>): UmbralesPreventivo {
  const v = leerCampos(AJUSTES_PREVENTIVO, config);
  return { ...v, diasAviso: Math.max(v.diasAviso, v.diasProximo) };
}

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
