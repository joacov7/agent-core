// ─── Inventario: lógica pura (sin DB) ────────────────────────────────────────
// Decide si un ítem hay que reponerlo o si está en quiebre de stock, a partir de
// la cantidad y su mínimo. Determinístico.

export type SeveridadInventario = "critica" | "importante";
export type TipoInventario = "quiebre" | "reponer";

export interface AlertaInventario {
  tipo: TipoInventario;
  severidad: SeveridadInventario;
  motivo: string;
}

// Clasifica una existencia. Null si hay stock suficiente (por encima del mínimo).
// Sin mínimo definido, solo alerta el quiebre (cantidad <= 0).
export function clasificarExistencia(
  e: { cantidad: number; minimo?: number },
): AlertaInventario | null {
  if (e.cantidad <= 0) {
    return { tipo: "quiebre", severidad: "critica", motivo: "sin stock" };
  }
  if (e.minimo != null && e.cantidad <= e.minimo) {
    return { tipo: "reponer", severidad: "importante", motivo: `stock ${e.cantidad} <= mínimo ${e.minimo}` };
  }
  return null;
}
