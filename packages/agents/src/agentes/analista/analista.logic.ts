// ─── Analista de negocio: lógica pura (sin DB) ───────────────────────────────
// KPIs y anomalías a partir del resumen transaccional por contacto. Determinístico.

export interface ResumenClienteKpi {
  contactoId: string;
  compras: number;
  totalGastado: number;
  ticketPromedio: number;
}

export interface KpisNegocio {
  clientes: number;
  comprasTotales: number;
  ingresoTotal: number;
  ticketPromedioGlobal: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularKpis(clientes: ResumenClienteKpi[]): KpisNegocio {
  const comprasTotales = clientes.reduce((s, c) => s + c.compras, 0);
  const ingresoTotal = clientes.reduce((s, c) => s + c.totalGastado, 0);
  return {
    clientes: clientes.length,
    comprasTotales,
    ingresoTotal: r2(ingresoTotal),
    ticketPromedioGlobal: comprasTotales > 0 ? r2(ingresoTotal / comprasTotales) : 0,
  };
}

export interface Anomalia {
  contactoId: string;
  ratio: number;
}

// Detecta clientes cuyo ticket promedio se desvía mucho del promedio global.
// `factor` = cuántas veces el promedio global marca la anomalía (default 3).
export function detectarAnomalias(
  clientes: ResumenClienteKpi[], factor = 3,
): Anomalia[] {
  const kpis = calcularKpis(clientes);
  if (kpis.ticketPromedioGlobal <= 0) return [];
  const out: Anomalia[] = [];
  for (const c of clientes) {
    const ratio = r2(c.ticketPromedio / kpis.ticketPromedioGlobal);
    if (ratio >= factor) out.push({ contactoId: c.contactoId, ratio });
  }
  return out.sort((a, b) => b.ratio - a.ratio);
}
