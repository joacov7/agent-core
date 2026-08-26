// ─── Compras / Proveedores: lógica pura (sin DB) ─────────────────────────────
// A partir de la existencia (cantidad, mínimo) decide cuánto reponer y con qué
// urgencia. Determinístico. Objetivo de reposición: 2× el mínimo.

export type SeveridadCompra = "critica" | "importante";

export interface AlertaCompra {
  severidad: SeveridadCompra;
  cantidadSugerida: number;
  motivo: string;
}

// Sugiere reposición si la existencia está en quiebre o por debajo del mínimo.
// Null si hay stock suficiente o no hay mínimo definido y aún queda stock.
export function calcularReposicion(
  e: { cantidad: number; minimo?: number },
): AlertaCompra | null {
  if (e.cantidad <= 0) {
    const objetivo = e.minimo != null ? e.minimo * 2 : 1;
    return { severidad: "critica", cantidadSugerida: objetivo, motivo: "quiebre de stock" };
  }
  if (e.minimo != null && e.cantidad <= e.minimo) {
    return { severidad: "importante", cantidadSugerida: Math.max(0, e.minimo * 2 - e.cantidad), motivo: `stock ${e.cantidad} <= mínimo ${e.minimo}` };
  }
  return null;
}
