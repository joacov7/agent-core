// ─── Cobros: lógica pura (sin DB) ────────────────────────────────────────────
// Decide qué cobrar y con qué urgencia a partir de datos REALES del cobro (estado,
// monto, días vencido). Determinístico: no infiere probabilidad de pago.

export type SeveridadCobro = "critica" | "importante" | "oportunidad";

export interface UmbralesCobros {
  /** Días de mora a partir de los cuales el cobro es crítico. */
  diasCritico: number;
  /** Monto mínimo para que el cobro amerite una alerta (evita ruido de centavos). */
  montoRelevante: number;
}

export const UMBRALES_COBROS_DEFAULT: UmbralesCobros = { diasCritico: 30, montoRelevante: 0 };

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
