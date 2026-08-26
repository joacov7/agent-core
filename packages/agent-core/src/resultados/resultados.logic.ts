// ─── Resultados de acciones: lógica pura (sin DB) ────────────────────────────
// Portado de Regionales casi tal cual. Clasificación y métricas. Separa SIEMPRE el
// resultado REAL (valor_real medido) del ESTIMADO (valor_esperado de la
// recomendación). No mezcla ni inventa.
//
// Nota de cadencia: `TipoResultado` incluye valores sales-flavored ("compro",
// "sin_whatsapp"). La mecánica es genérica; la taxonomía concreta debería quedar
// configurable por vertical (follow-up), no horneada en el Core.

export type TipoResultado =
  | "ejecutada"      // determinístico: la acción se ejecutó
  | "respondio"      // el destinatario respondió
  | "compro"         // se concretó una venta (con vínculo/valor real)
  | "rechazado"      // el destinatario rechazó
  | "no_respondio"   // pasó el tiempo sin respuesta
  | "sin_whatsapp"   // no tenía WhatsApp / no se pudo entregar
  | "error";         // la ejecución falló

export const TIPOS_RESULTADO: TipoResultado[] = [
  "ejecutada", "respondio", "compro", "rechazado", "no_respondio", "sin_whatsapp", "error",
];

// Un resultado "positivo" es el que convierte (venta). Se usa para tasas.
export function esPositivo(tipo: TipoResultado): boolean {
  return tipo === "compro";
}
export function esNegativo(tipo: TipoResultado): boolean {
  return tipo === "rechazado" || tipo === "no_respondio" || tipo === "sin_whatsapp" || tipo === "error";
}

export interface ResultadoRow {
  tipo: TipoResultado;
  valor_real: number | null;
}

export interface MetricasResultados {
  total: number;
  porTipo: Record<string, number>;
  positivos: number;
  negativos: number;
  // Valor económico REAL acumulado (solo de resultados con valor medido).
  valorRealTotal: number;
  // Cuántos resultados aportaron valor real (para saber cuán completa es la medición).
  conValorReal: number;
}

// Agrega métricas SOLO con datos reales. El valor estimado se calcula aparte
// (a partir de las recomendaciones), y nunca se suma acá.
export function agregarMetricas(results: ResultadoRow[]): MetricasResultados {
  const porTipo: Record<string, number> = {};
  let positivos = 0, negativos = 0, valorRealTotal = 0, conValorReal = 0;
  for (const r of results) {
    porTipo[r.tipo] = (porTipo[r.tipo] ?? 0) + 1;
    if (esPositivo(r.tipo)) positivos++;
    if (esNegativo(r.tipo)) negativos++;
    if (r.valor_real != null) { valorRealTotal += Number(r.valor_real); conValorReal++; }
  }
  return {
    total: results.length, porTipo, positivos, negativos,
    valorRealTotal: Math.round(valorRealTotal * 100) / 100, conValorReal,
  };
}
