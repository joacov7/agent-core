// ─── Flujo de caja: lógica pura (sin DB) ─────────────────────────────────────
// Proyecta ingresos (cobros por vencer) y egresos (compras/pagos) en ventanas
// temporales. Determinístico: no estima probabilidad de pago, solo agrupa montos
// ciertos por fecha esperada.

export type RangoFlujo = "0-7" | "8-30" | "31-60" | "60+";
export const RANGOS: RangoFlujo[] = ["0-7", "8-30", "31-60", "60+"];

export interface MovimientoFlujo {
  /** Fecha esperada (ISO). Sin fecha → cae en el bucket "60+" (timing incierto). */
  fecha?: string;
  monto: number;
}

export interface BucketFlujo {
  rango: RangoFlujo;
  ingresos: number;
  egresos: number;
  neto: number;
}

export interface ProyeccionFlujo {
  buckets: BucketFlujo[];
  ingresosTotal: number;
  egresosTotal: number;
  netoTotal: number;
}

function diasHasta(fecha: string | undefined, hoy: Date): number | null {
  if (!fecha) return null;
  return Math.floor((new Date(fecha).getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

// Un vencido (días < 0) se cuenta como flujo inmediato (bucket "0-7").
function rangoDe(dias: number | null): RangoFlujo {
  if (dias == null) return "60+";
  if (dias <= 7) return "0-7";
  if (dias <= 30) return "8-30";
  if (dias <= 60) return "31-60";
  return "60+";
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function proyectarFlujo(
  ingresos: MovimientoFlujo[], egresos: MovimientoFlujo[], hoy: Date = new Date(),
): ProyeccionFlujo {
  const buckets: Record<RangoFlujo, BucketFlujo> = {
    "0-7": { rango: "0-7", ingresos: 0, egresos: 0, neto: 0 },
    "8-30": { rango: "8-30", ingresos: 0, egresos: 0, neto: 0 },
    "31-60": { rango: "31-60", ingresos: 0, egresos: 0, neto: 0 },
    "60+": { rango: "60+", ingresos: 0, egresos: 0, neto: 0 },
  };

  for (const m of ingresos) buckets[rangoDe(diasHasta(m.fecha, hoy))].ingresos += m.monto;
  for (const m of egresos) buckets[rangoDe(diasHasta(m.fecha, hoy))].egresos += m.monto;

  let ingresosTotal = 0, egresosTotal = 0;
  for (const rango of RANGOS) {
    const b = buckets[rango];
    b.ingresos = r2(b.ingresos);
    b.egresos = r2(b.egresos);
    b.neto = r2(b.ingresos - b.egresos);
    ingresosTotal += b.ingresos;
    egresosTotal += b.egresos;
  }

  return {
    buckets: RANGOS.map((r) => buckets[r]),
    ingresosTotal: r2(ingresosTotal),
    egresosTotal: r2(egresosTotal),
    netoTotal: r2(ingresosTotal - egresosTotal),
  };
}
