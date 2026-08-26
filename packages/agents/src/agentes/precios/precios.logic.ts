// ─── Precios: lógica pura (sin DB) ───────────────────────────────────────────
// Sugiere alinear el precio al mercado respetando un margen mínimo sobre el costo.
// Determinístico. No baja por debajo del piso de margen ni sugiere cambios menores
// a la tolerancia.

export interface UmbralesPrecios {
  /** Margen mínimo (%) sobre el precio de venta que hay que preservar. */
  margenMinimoPct: number;
  /** Cambios (%) por debajo de esto no ameritan sugerencia. */
  toleranciaPct: number;
}

export const UMBRALES_PRECIOS_DEFAULT: UmbralesPrecios = { margenMinimoPct: 25, toleranciaPct: 5 };

export interface SugerenciaPrecio {
  accion: "subir" | "bajar";
  precioSugerido: number;
  motivo: string;
}

// Piso de precio que respeta el margen mínimo: precio tal que (precio - costo)/precio = m.
function pisoPorMargen(costo: number, margenMinimoPct: number): number {
  const m = margenMinimoPct / 100;
  return m < 1 ? Math.round((costo / (1 - m)) * 100) / 100 : Infinity;
}

// Sugiere un precio alineado al mercado, con piso de margen. Null si el cambio es
// menor a la tolerancia (mantener). Requiere precio y precio de mercado válidos.
export function sugerirPrecio(
  p: { precio: number; costo?: number | null; precioMercado: number },
  u: UmbralesPrecios = UMBRALES_PRECIOS_DEFAULT,
): SugerenciaPrecio | null {
  if (!(p.precio > 0) || !(p.precioMercado > 0)) return null;

  const piso = p.costo != null && p.costo > 0 ? pisoPorMargen(p.costo, u.margenMinimoPct) : 0;
  const precioSugerido = Math.max(p.precioMercado, piso);

  const cambioPct = ((precioSugerido - p.precio) / p.precio) * 100;
  if (Math.abs(cambioPct) <= u.toleranciaPct) return null;

  const accion = precioSugerido > p.precio ? "subir" : "bajar";
  const motivo = precioSugerido > p.precioMercado
    ? `alinear al mercado (${p.precioMercado}) con piso de margen ${u.margenMinimoPct}% → ${precioSugerido}`
    : `alinear al mercado → ${precioSugerido}`;
  return { accion, precioSugerido, motivo };
}
