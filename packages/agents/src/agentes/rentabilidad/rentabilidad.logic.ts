// ─── Rentabilidad: clasificación pura (sin DB) ───────────────────────────────
// A partir de los datos REALES de un producto (precio, costo, margen, ventas,
// stock, inmovilizado), decide si hay una alerta de rentabilidad. Determinístico.
// No inventa: si falta el costo (margen desconocido), no emite alertas de margen.

export interface RentabilidadItem {
  id: string; nombre: string; precio: number; costo: number | null;
  margen_pct: number | null; ventas_30d: number; stock: number; valor_inmovilizado: number | null;
}

export interface UmbralesRentabilidad {
  margenMinimo: number;        // % — margen por debajo del cual se alerta
  ventasAltaRotacion: number;  // ventas_30d ≥ esto = alta rotación
  inmovilizadoMinimo: number;  // $ — capital inmovilizado a partir del cual se alerta
  margenAlto: number;          // % — margen "alto" para oportunidad de promoción
}

export const UMBRALES_DEFAULT: UmbralesRentabilidad = {
  margenMinimo: 25, ventasAltaRotacion: 5, inmovilizadoMinimo: 100000, margenAlto: 35,
};

export type TipoRentabilidad = "margen_bajo" | "inmovilizado" | "oportunidad_margen";

export interface AlertaRentabilidad {
  tipo: TipoRentabilidad;
  severidad: "critica" | "importante" | "oportunidad";
  titulo: string;
  descripcion: string;
  impactoEstimado: number | null; // solo cuando es un monto REAL (ej. inmovilizado)
}

const ars = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

// Clasifica un producto en (a lo sumo) UNA alerta de rentabilidad, por prioridad:
// margen_bajo > inmovilizado > oportunidad_margen. Null si no hay alerta.
export function clasificarRentabilidad(
  p: RentabilidadItem, u: UmbralesRentabilidad = UMBRALES_DEFAULT
): AlertaRentabilidad | null {
  // 1. Margen por debajo del mínimo (requiere costo conocido).
  if (p.margen_pct != null && p.margen_pct < u.margenMinimo) {
    const alta = p.ventas_30d >= u.ventasAltaRotacion;
    return {
      tipo: "margen_bajo",
      severidad: alta ? "importante" : "oportunidad",
      titulo: `Margen bajo: ${p.nombre} (${p.margen_pct}%)`,
      descripcion: alta
        ? `Vende bien (${p.ventas_30d} en 30 días) pero deja solo ${p.margen_pct}% de margen. Revisar precio o costo.`
        : `Margen de ${p.margen_pct}%, por debajo del mínimo de ${u.margenMinimo}%. Poca rotación (${p.ventas_30d}/30d).`,
      impactoEstimado: null, // sin datos de volumen proyectado no se estima el impacto
    };
  }
  // 2. Capital inmovilizado (sin ventas y stock que vale dinero).
  if (p.ventas_30d === 0 && p.valor_inmovilizado != null && p.valor_inmovilizado >= u.inmovilizadoMinimo) {
    return {
      tipo: "inmovilizado",
      severidad: "importante",
      titulo: `Inmovilizado: ${p.nombre}`,
      descripcion: `${ars(p.valor_inmovilizado)} en stock (${p.stock} u.) sin ventas en 30 días. Evaluar oferta, combo o discontinuar.`,
      impactoEstimado: p.valor_inmovilizado, // monto REAL inmovilizado
    };
  }
  // 3. Oportunidad: alto margen y poca promoción (rota poco pero deja bien).
  if (p.margen_pct != null && p.margen_pct >= u.margenAlto && p.ventas_30d < u.ventasAltaRotacion) {
    return {
      tipo: "oportunidad_margen",
      severidad: "oportunidad",
      titulo: `Alto margen sin explotar: ${p.nombre} (${p.margen_pct}%)`,
      descripcion: `Deja ${p.margen_pct}% pero vende poco (${p.ventas_30d}/30d). Buen candidato para promocionar.`,
      impactoEstimado: null,
    };
  }
  return null;
}
