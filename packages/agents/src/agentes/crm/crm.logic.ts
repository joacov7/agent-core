// ─── CRM Customer Score: lógica pura (sin DB) ────────────────────────────────
// Calcula un score y el riesgo de abandono por cliente a partir de datos REALES
// (valor histórico, recencia, frecuencia). Determinístico y documentado; no
// inventa: si falta frecuencia (1 sola compra), usa un umbral por defecto y baja
// la confianza del riesgo.

export interface MetricasCliente {
  key: string; nombre: string; email: string | null; telefono: string | null;
  compras: number; total_gastado: number; ticket_promedio: number;
  ultima_compra: string; dias_desde_ultima: number; frecuencia_dias: number | null;
}

export type Riesgo = "bajo" | "medio" | "alto";

export interface CustomerScore {
  score: number;              // 0-100
  riesgo_abandono: Riesgo;
  proxima_accion: string;
  confianza: number;          // 0-100 (menor si hay poca historia)
  motivos: string[];
}

const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const UMBRAL_SIN_FRECUENCIA = 60; // días, cuando el cliente tiene 1 sola compra

// Score = 50% valor histórico (relativo a la cohorte) + 30% recencia + 20% frecuencia.
export function scoreCliente(m: MetricasCliente, ctx: { maxValor: number }): CustomerScore {
  const valorRel = ctx.maxValor > 0 ? clamp(m.total_gastado / ctx.maxValor) : 0;
  const umbral = m.frecuencia_dias ?? UMBRAL_SIN_FRECUENCIA;
  const recencia = clamp(1 - m.dias_desde_ultima / (umbral * 2));
  const frecuencia = clamp(m.compras / 6);
  const score = Math.round(100 * (0.5 * valorRel + 0.3 * recencia + 0.2 * frecuencia));

  // Riesgo de abandono según cuánto se pasó de su frecuencia habitual.
  let riesgo: Riesgo = "bajo";
  if (m.dias_desde_ultima > umbral * 1.5) riesgo = "alto";
  else if (m.dias_desde_ultima > umbral) riesgo = "medio";

  // Confianza: más historia (compras) → más confiable el diagnóstico.
  const confianza = m.compras >= 3 ? 85 : m.compras === 2 ? 65 : 45;

  const motivos: string[] = [];
  motivos.push(`${m.compras} compra(s), ${valorRel >= 0.5 ? "alto" : valorRel >= 0.2 ? "medio" : "bajo"} valor histórico`);
  motivos.push(`última compra hace ${m.dias_desde_ultima} días${m.frecuencia_dias ? ` (habitual: ~${m.frecuencia_dias})` : ""}`);

  // Próxima acción: prioriza reactivar a los buenos clientes en riesgo.
  let proxima_accion = "sin acción";
  if (riesgo === "alto" && valorRel >= 0.3) proxima_accion = "contactar (cliente valioso en riesgo)";
  else if (riesgo === "alto") proxima_accion = "contactar";
  else if (riesgo === "medio") proxima_accion = "seguir de cerca";

  return { score, riesgo_abandono: riesgo, proxima_accion, confianza, motivos };
}

// ¿Amerita una recomendación de reactivación? Solo clientes en riesgo alto con
// valor suficiente (evita ruido con compradores ocasionales de bajo valor).
export function ameritaReactivacion(m: MetricasCliente, s: CustomerScore, ctx: { maxValor: number }): boolean {
  const valorRel = ctx.maxValor > 0 ? m.total_gastado / ctx.maxValor : 0;
  return s.riesgo_abandono === "alto" && valorRel >= 0.3 && m.compras >= 2;
}
