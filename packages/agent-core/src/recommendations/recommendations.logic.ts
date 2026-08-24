// ─── Lógica pura de recomendaciones (sin dependencias de DB) ─────────────────
// Portado de Regionales casi tal cual. Se separa del I/O (Prisma) para poder testear
// prioridad, severidad, confianza, valor esperado, dedup y la máquina de estados
// sin base de datos. Los TIPOS canónicos (EstadoReco, Severidad, OrigenConfianza,
// Evidencia) viven en @agent-core/contracts; acá quedan solo las funciones puras.

import type { EstadoReco, Severidad, OrigenConfianza } from "@agent-core/contracts";

// ─── Máquina de transiciones ─────────────────────────────────────────────────
// Estados "vivos": una sola recomendación por dedup_key puede estar en estos.
export const ESTADOS_VIVOS: EstadoReco[] = [
  "new", "analyzing", "proposed", "pending_approval", "postponed",
];

// Transiciones permitidas (validadas del lado del servidor).
const TRANSICIONES: Record<EstadoReco, EstadoReco[]> = {
  new:              ["analyzing", "proposed", "pending_approval", "cancelled", "expired"],
  analyzing:        ["proposed", "pending_approval", "cancelled", "expired"],
  proposed:         ["pending_approval", "postponed", "rejected", "cancelled", "expired"],
  pending_approval: ["approved", "rejected", "postponed", "cancelled", "expired"],
  approved:         ["executing", "cancelled"],
  executing:        ["executed", "failed"],
  postponed:        ["pending_approval", "proposed", "cancelled", "expired"],
  // Estados terminales (sin salida):
  executed:  [],
  failed:    ["pending_approval"], // se puede reintentar
  rejected:  [],
  expired:   [],
  cancelled: [],
};

export function puedeTransicionar(desde: EstadoReco, hacia: EstadoReco): boolean {
  return (TRANSICIONES[desde] ?? []).includes(hacia);
}

// ─── Severidad ──────────────────────────────────────────────────────────────
const SEVERIDAD_RANK: Record<Severidad, number> = { critica: 3, importante: 2, oportunidad: 1 };
export function severidadMax(a: Severidad, b: Severidad): Severidad {
  return SEVERIDAD_RANK[a] >= SEVERIDAD_RANK[b] ? a : b;
}

// ─── Confianza (0-100): estrategia consistente y documentada ────────────────
// La confianza NO se inventa: se deriva del ORIGEN del dato.
//   • determinístico  (dato leído tal cual del sistema)      → 95
//   • cálculo          (matemática sobre datos ciertos)        → 90
//   • inferencia_alta  (regla + evidencia suficiente)          → 80
//   • inferencia_media (regla + evidencia parcial)             → 60
//   • inferencia_baja  (poca evidencia)                        → 40
//   • ia               (texto/clasificación por IA)            → 55
//   • incompleto       (faltan datos clave)                    → 30
const CONFIANZA_POR_ORIGEN: Record<OrigenConfianza, number> = {
  deterministico: 95, calculo: 90, inferencia_alta: 80, inferencia_media: 60,
  inferencia_baja: 40, ia: 55, incompleto: 30,
};

export function confianzaPorOrigen(origen: OrigenConfianza): number {
  return CONFIANZA_POR_ORIGEN[origen];
}

// ─── Valor esperado ─────────────────────────────────────────────────────────
// valor_esperado = impacto_económico × probabilidad × margen.
// Devuelve null (→ "sin estimación") si falta cualquier componente, para no
// fabricar precisión inexistente.
export function calcularValorEsperado(p: {
  impacto?: number | null;
  probabilidad?: number | null; // 0..1
  margen?: number | null;       // 0..1 (fracción). Default 1 si no aplica.
}): number | null {
  if (p.impacto == null || p.probabilidad == null) return null;
  const margen = p.margen == null ? 1 : p.margen;
  const v = p.impacto * p.probabilidad * margen;
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

// ─── Prioridad (1 = máxima … 5 = mínima) ────────────────────────────────────
// Base por severidad; se ajusta por confianza y por si hay estimación económica.
// Sin valor esperado → baja la prioridad (evita falsa urgencia).
export function calcularPrioridad(input: {
  severidad: Severidad;
  confianza?: number | null;
  valorEsperado?: number | null;
}): number {
  let p = input.severidad === "critica" ? 1 : input.severidad === "importante" ? 2 : 3;
  if (input.valorEsperado == null) p += 1;                 // sin estimación → menos prioridad
  if ((input.confianza ?? 0) < 50) p += 1;                 // poca confianza → menos prioridad
  if ((input.valorEsperado ?? 0) > 0 && (input.confianza ?? 0) >= 80) p -= 1; // fuerte y confiable → sube
  return Math.min(5, Math.max(1, p));
}

// ─── dedupKey ───────────────────────────────────────────────────────────────
// Clave conservadora de agrupación: tipo + entidad. Sin entidad no hay dedup
// (devuelve null) para no fusionar cosas distintas por error.
export function dedupKey(input: {
  tipo: string;
  entityType?: string | null;
  entityId?: string | null;
  extra?: string | null;
}): string | null {
  if (!input.entityType || !input.entityId) {
    return input.extra ? `${input.tipo}:${input.extra}` : null;
  }
  const base = `${input.tipo}:${input.entityType}:${input.entityId}`;
  return input.extra ? `${base}:${input.extra}` : base;
}
