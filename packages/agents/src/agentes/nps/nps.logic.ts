// ─── Reputación / NPS: lógica pura (sin DB) ──────────────────────────────────
// Clasifica respuestas de satisfacción en la escala NPS y calcula el índice.
// Determinístico. NPS estándar: promotor 9-10, pasivo 7-8, detractor 0-6, sobre
// una escala 0..10 (si la respuesta viene en otra escala, se normaliza a 0..10).

export type CategoriaNps = "promotor" | "pasivo" | "detractor";

export interface RespuestaNps {
  id: string;
  contactoId: string | null;
  puntaje: number;
  escala: number;      // máximo de la escala original (default 10)
  comentario: string | null;
}

/** Normaliza un puntaje a la escala 0..10 de NPS. */
export function aEscalaNps(puntaje: number, escala: number): number {
  if (escala <= 0) return 0;
  const n = (puntaje / escala) * 10;
  return Math.max(0, Math.min(10, n));
}

/** Categoría NPS de un puntaje ya en escala 0..10. */
export function clasificarNps(puntaje0a10: number): CategoriaNps {
  if (puntaje0a10 >= 9) return "promotor";
  if (puntaje0a10 >= 7) return "pasivo";
  return "detractor";
}

export interface ResumenNps {
  nps: number;         // -100..100
  total: number;
  promotores: number;
  pasivos: number;
  detractores: number;
}

/** Calcula el NPS: % promotores − % detractores (redondeado). Total 0 → nps 0. */
export function calcularNps(respuestas: RespuestaNps[]): ResumenNps {
  let promotores = 0, pasivos = 0, detractores = 0;
  for (const r of respuestas) {
    const cat = clasificarNps(aEscalaNps(r.puntaje, r.escala));
    if (cat === "promotor") promotores++;
    else if (cat === "pasivo") pasivos++;
    else detractores++;
  }
  const total = respuestas.length;
  const nps = total === 0 ? 0 : Math.round(((promotores - detractores) / total) * 100);
  return { nps, total, promotores, pasivos, detractores };
}

/** Detractores (para seguimiento de reputación), en el orden recibido. */
export function detractores(respuestas: RespuestaNps[]): RespuestaNps[] {
  return respuestas.filter((r) => clasificarNps(aEscalaNps(r.puntaje, r.escala)) === "detractor");
}
