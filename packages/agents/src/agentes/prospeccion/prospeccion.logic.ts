// ─── Prospección: lógica pura (sin DB) ───────────────────────────────────────
// Toma señales de fuentes externas (directorio, referido, marketplace, web) y las
// prioriza por encaje, descartando las que YA están en la base (dedup por clave).
// Determinístico: la confianza sale del peso de la fuente combinado con el score
// declarado; no inventa intención donde la fuente no la reporta.

export interface SenalProspecto {
  id: string;
  fuente: string;
  nombre: string;
  clave: string | null;    // email/teléfono/CUIT para deduplicar contra la base
  motivo: string | null;   // señal de intención/encaje (texto de la fuente)
  score: number | null;    // 0..100 encaje declarado por la fuente (opcional)
}

export interface Prospecto {
  id: string;
  nombre: string;
  fuente: string;
  clave: string | null;
  motivo: string | null;
  confianza: number;       // 0..100
}

// Peso de confianza por tipo de fuente. Un referido pesa más que un scraping web.
// Conservador y documentado; la app puede sobrescribirlo por fuente.
export const PESOS_FUENTE_DEFAULT: Record<string, number> = {
  referido: 80,
  directorio: 60,
  marketplace: 55,
  web: 45,
};
const PESO_FUENTE_DESCONOCIDA = 50;

function normalizarClave(clave: string | null): string | null {
  if (clave == null) return null;
  const k = clave.trim().toLowerCase();
  return k.length > 0 ? k : null;
}

function clamp0a100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Confianza: peso de la fuente, mezclado 50/50 con el score declarado si existe.
export function confianzaProspecto(
  senal: Pick<SenalProspecto, "fuente" | "score">,
  pesosFuente: Record<string, number> = PESOS_FUENTE_DEFAULT,
): number {
  const peso = pesosFuente[senal.fuente.trim().toLowerCase()] ?? PESO_FUENTE_DESCONOCIDA;
  if (senal.score == null) return clamp0a100(peso);
  return clamp0a100(0.5 * senal.score + 0.5 * peso);
}

/**
 * Prioriza prospectos externos. Descarta los que ya están en la base (por `clave`),
 * deduplica señales repetidas (misma clave → la de mayor confianza; sin clave →
 * por id), filtra por confianza mínima y ordena desc. Tope para no hacer ruido.
 */
export function detectarProspectos(
  senales: SenalProspecto[],
  clavesBase: Iterable<string>,
  opts: {
    pesosFuente?: Record<string, number>;
    max?: number;
    minConfianza?: number;
  } = {},
): Prospecto[] {
  const pesos = opts.pesosFuente ?? PESOS_FUENTE_DEFAULT;
  const max = opts.max ?? 20;
  const minConfianza = opts.minConfianza ?? 50;

  const enBase = new Set<string>();
  for (const k of clavesBase) {
    const n = normalizarClave(k);
    if (n) enBase.add(n);
  }

  // dedup: por clave normalizada si hay, si no por id. Nos quedamos con el de mayor confianza.
  const mejores = new Map<string, Prospecto>();
  for (const s of senales) {
    const clave = normalizarClave(s.clave);
    if (clave && enBase.has(clave)) continue; // ya es contacto → no es prospecto

    const confianza = confianzaProspecto(s, pesos);
    if (confianza < minConfianza) continue;

    const dedupKey = clave ?? `id:${s.id}`;
    const prospecto: Prospecto = {
      id: s.id, nombre: s.nombre, fuente: s.fuente, clave, motivo: s.motivo, confianza,
    };
    const prev = mejores.get(dedupKey);
    if (!prev || confianza > prev.confianza) mejores.set(dedupKey, prospecto);
  }

  return [...mejores.values()]
    .sort((a, b) => b.confianza - a.confianza)
    .slice(0, max);
}
