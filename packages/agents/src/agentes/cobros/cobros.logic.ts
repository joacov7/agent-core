// ─── Cobros: lógica pura (sin DB) ────────────────────────────────────────────
// Decide qué cobrar y con qué urgencia a partir de datos REALES del cobro (estado,
// monto, días vencido). Determinístico: no infiere probabilidad de pago.

import { leerCampos, type CamposAjuste } from "../../ajustes.js";

export type SeveridadCobro = "critica" | "importante" | "oportunidad";

export interface UmbralesCobros {
  /** Días de mora a partir de los cuales el cobro es crítico. */
  diasCritico: number;
  /** Monto mínimo para que el cobro amerite una alerta (evita ruido de centavos). */
  montoRelevante: number;
}

export const UMBRALES_COBROS_DEFAULT: UmbralesCobros = { diasCritico: 30, montoRelevante: 0 };

export const AJUSTES_COBROS: CamposAjuste<keyof UmbralesCobros> = {
  diasCritico: { titulo: "Cobro crítico", descripcion: "Días de atraso desde los que un cobro vencido es crítico (antes es importante).", default: 30, min: 1, max: 365, unidad: "días" },
  montoRelevante: { titulo: "Monto mínimo", descripcion: "Los cobros por este monto o menos no generan alerta (evita ruido de centavos).", default: 0, min: 0, max: 1_000_000_000, entero: false },
};

export function umbralesCobrosDeConfig(config?: Record<string, unknown>): UmbralesCobros {
  return leerCampos(AJUSTES_COBROS, config);
}

export interface CobroInput {
  estado: string;
  monto: number;
  /** Días vencido: > 0 vencido, <= 0 aún no vence. */
  diasVencido: number;
}

export interface AlertaCobro {
  severidad: SeveridadCobro;
  motivo: string;
}

// Clasifica un cobro en (a lo sumo) una alerta. Null si no amerita: ya cobrado/
// incobrable, monto irrelevante, o todavía no vencido.
export function clasificarCobro(
  c: CobroInput, u: UmbralesCobros = UMBRALES_COBROS_DEFAULT,
): AlertaCobro | null {
  if (c.estado === "cobrado" || c.estado === "incobrable") return null;
  if (c.monto <= u.montoRelevante) return null;
  if (c.diasVencido <= 0) return null;
  const severidad: SeveridadCobro = c.diasVencido >= u.diasCritico ? "critica" : "importante";
  return { severidad, motivo: `vencido hace ${c.diasVencido} día(s)` };
}

/** Días vencido de un cobro respecto de `hoy` (0 si no tiene vencimiento). */
export function diasVencido(venceEn: string | undefined, hoy: Date): number {
  if (!venceEn) return 0;
  const ms = hoy.getTime() - new Date(venceEn).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
