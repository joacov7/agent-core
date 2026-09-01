// ─── Sistemas / Triage de incidentes: lógica pura (sin DB) ───────────────────
// Prioriza incidentes de software para decidir cuál atacar primero. Determinístico:
// combina severidad del nivel, frecuencia, usuarios afectados, recencia y entorno
// en un score 0..100. NO corrige código ni sugiere parches (eso es una acción de
// una entrega posterior); acá solo triage.

export type SeveridadSistemas = "critica" | "importante" | "oportunidad";

export interface PesosSistemas {
  /** Peso por nivel de severidad del error. */
  nivel: Record<string, number>;
  nivelDefault: number;
  /** Máximo aporte de la frecuencia (ocurrencias) al score. */
  maxFrecuencia: number;
  /** Ocurrencias que saturan el aporte de frecuencia. */
  ocurrenciasSaturacion: number;
  /** Máximo aporte de usuarios afectados. */
  maxUsuarios: number;
  /** Usuarios que saturan ese aporte. */
  usuariosSaturacion: number;
  /** Aporte por entorno productivo. */
  bonusProduccion: number;
}

export const PESOS_SISTEMAS_DEFAULT: PesosSistemas = {
  nivel: { fatal: 40, error: 25, warning: 10 },
  nivelDefault: 15,
  maxFrecuencia: 25,
  ocurrenciasSaturacion: 100,
  maxUsuarios: 20,
  usuariosSaturacion: 100,
  bonusProduccion: 10,
};

export interface UmbralesSistemas {
  /** Score mínimo para no considerarlo ruido (por debajo, se descarta). */
  minScore: number;
  /** Score a partir del cual es crítico. */
  critico: number;
  /** Score a partir del cual es importante. */
  importante: number;
  /** Tope de incidentes a devolver. */
  max: number;
}

export const UMBRALES_SISTEMAS_DEFAULT: UmbralesSistemas = {
  minScore: 20, critico: 70, importante: 40, max: 20,
};

export interface IncidenteInput {
  id: string;
  firma: string;
  titulo: string;
  servicio: string | null;
  entorno: string | null;
  nivel: string | null;
  ocurrencias: number;
  usuariosAfectados: number | null;
  ultimaVez: string | null;
  estado: string | null;
}

export interface IncidentePriorizado {
  id: string;
  firma: string;
  titulo: string;
  servicio: string | null;
  score: number;
  severidad: SeveridadSistemas;
  motivo: string;
}

function norm(s: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

/** ¿El entorno es productivo? (prod / produccion / production). */
export function esProduccion(entorno: string | null): boolean {
  const e = norm(entorno);
  return e === "prod" || e === "produccion" || e === "production";
}

/** ¿El incidente amerita triage? Descarta resueltos e ignorados. */
export function esRelevante(inc: Pick<IncidenteInput, "estado">): boolean {
  const e = norm(inc.estado);
  return e !== "resuelto" && e !== "ignorado" && e !== "cerrado";
}

function aporteRecencia(ultimaVez: string | null, hoy: Date): number {
  if (!ultimaVez) return 0;
  const dias = Math.floor((hoy.getTime() - new Date(ultimaVez).getTime()) / (24 * 60 * 60 * 1000));
  if (dias <= 1) return 15;
  if (dias <= 7) return 8;
  if (dias <= 30) return 3;
  return 0;
}

/** Score 0..100 de un incidente (determinístico). */
export function puntuarIncidente(
  inc: IncidenteInput, hoy: Date, p: PesosSistemas = PESOS_SISTEMAS_DEFAULT,
): number {
  const nivel = p.nivel[norm(inc.nivel)] ?? p.nivelDefault;
  const freq = Math.min(Math.max(inc.ocurrencias, 0), p.ocurrenciasSaturacion) / p.ocurrenciasSaturacion * p.maxFrecuencia;
  const usuarios = Math.min(Math.max(inc.usuariosAfectados ?? 0, 0), p.usuariosSaturacion) / p.usuariosSaturacion * p.maxUsuarios;
  const recencia = aporteRecencia(inc.ultimaVez, hoy);
  const entorno = esProduccion(inc.entorno) ? p.bonusProduccion : 0;
  const score = nivel + freq + usuarios + recencia + entorno;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Mapea un score a severidad canónica. */
export function severidadDeScore(
  score: number, u: UmbralesSistemas = UMBRALES_SISTEMAS_DEFAULT,
): SeveridadSistemas {
  if (score >= u.critico) return "critica";
  if (score >= u.importante) return "importante";
  return "oportunidad";
}

/**
 * Prioriza incidentes: descarta resueltos/ignorados y ruido (< minScore), deduplica
 * por firma (se queda con el de mayor score), ordena desc y aplica el tope.
 */
export function priorizarIncidentes(
  incidentes: IncidenteInput[], hoy: Date,
  opts: { pesos?: PesosSistemas; umbrales?: UmbralesSistemas } = {},
): IncidentePriorizado[] {
  const pesos = opts.pesos ?? PESOS_SISTEMAS_DEFAULT;
  const u = opts.umbrales ?? UMBRALES_SISTEMAS_DEFAULT;

  const porFirma = new Map<string, IncidentePriorizado>();
  for (const inc of incidentes) {
    if (!esRelevante(inc)) continue;
    const score = puntuarIncidente(inc, hoy, pesos);
    if (score < u.minScore) continue;

    const severidad = severidadDeScore(score, u);
    const partes = [
      `nivel ${norm(inc.nivel) || "?"}`,
      `${inc.ocurrencias} ocurrencia(s)`,
      ...(inc.usuariosAfectados ? [`${inc.usuariosAfectados} usuario(s)`] : []),
      ...(esProduccion(inc.entorno) ? ["en producción"] : []),
    ];
    const candidato: IncidentePriorizado = {
      id: inc.id, firma: inc.firma, titulo: inc.titulo, servicio: inc.servicio,
      score, severidad, motivo: partes.join(", "),
    };
    const prev = porFirma.get(inc.firma);
    if (!prev || score > prev.score) porFirma.set(inc.firma, candidato);
  }

  return [...porFirma.values()].sort((a, b) => b.score - a.score).slice(0, u.max);
}
