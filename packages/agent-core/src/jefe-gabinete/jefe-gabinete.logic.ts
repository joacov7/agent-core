// ─── Jefe de Gabinete: lógica pura (sin DB, sin IA) ──────────────────────────
// Portado de Regionales casi tal cual. Coordina, prioriza y resume las
// recomendaciones que ya generaron los agentes. NO ejecuta acciones, NO crea
// acciones económicas, NO reemplaza a los agentes.
//
// Flujo: leer → deduplicar → agrupar → detectar conflictos → priorizar →
//        seleccionar top 3-5 → generar resumen.
//
// La SELECCIÓN de prioridades es 100% determinística. La IA (si existe) solo
// puede redactar/mejorar el texto final — nunca decide las prioridades.

// Subconjunto de Recommendation que necesita el Jefe (más las fuentes/agentes).
// Nota: usa snake_case porque refleja la fila de la tabla del Core; la
// reconciliación con el canónico camelCase de contracts es un follow-up.
export interface RecoJefe {
  id: number;
  agent_id: string;
  tipo: string;
  titulo: string;
  descripcion?: string | null;
  prioridad: number | null;
  severidad: "critica" | "importante" | "oportunidad";
  impacto_estimado: number | null;
  valor_esperado: number | null;
  confianza: number | null;
  estado: string;
  entity_type: string | null;
  entity_id: string | null;
  action_tool: string | null;
  dedup_key: string | null;
  metadata?: any;
  agentes?: string[]; // de recommendation_sources (quiénes la detectaron)
}

export interface Conflicto {
  tipo: "evidencia_insuficiente" | "contradiccion";
  entity: string | null;
  motivo: string;
  recomendaciones: number[];
  agentes: string[];
}

export interface ResumenJefe {
  conteos: { criticas: number; importantes: number; oportunidades: number };
  conflictos: Conflicto[];
  seleccionadas: RecoJefe[];
  consideradas: number[];
  agentes: string[];
  resultado: "ok" | "sin_datos";
  textoPlantilla: string;
}

// Umbral de confianza por debajo del cual una recomendación ACCIONABLE no se
// considera suficientemente respaldada (se marca como conflicto, no se prioriza).
export const UMBRAL_CONFIANZA = 60;

const SEV_RANK: Record<RecoJefe["severidad"], number> = { critica: 3, importante: 2, oportunidad: 1 };

function entityKey(r: RecoJefe): string | null {
  return r.entity_type && r.entity_id ? `${r.entity_type}:${r.entity_id}` : null;
}

// ─── Deduplicar ──────────────────────────────────────────────────────────────
// Las recomendaciones ya son únicas por dedup_key en la base; acá colapsamos
// además las que apuntan a la misma entidad+tipo (por si vinieran de claves
// distintas), quedándonos con la de mayor prioridad y uniendo sus agentes.
export function deduplicar(recs: RecoJefe[]): RecoJefe[] {
  const porClave = new Map<string, RecoJefe>();
  const sueltas: RecoJefe[] = [];
  for (const r of recs) {
    const k = entityKey(r) ? `${entityKey(r)}::${r.tipo}` : null;
    if (!k) { sueltas.push(r); continue; }
    const prev = porClave.get(k);
    if (!prev) { porClave.set(k, { ...r, agentes: [...(r.agentes ?? [r.agent_id])] }); continue; }
    // Merge: mejor prioridad (menor) gana; se unen agentes.
    const mejor = (prev.prioridad ?? 9) <= (r.prioridad ?? 9) ? prev : r;
    const agentes = Array.from(new Set([...(prev.agentes ?? []), ...(r.agentes ?? [r.agent_id])]));
    porClave.set(k, { ...mejor, agentes });
  }
  return [...porClave.values(), ...sueltas];
}

// ─── Agrupar por entidad ──────────────────────────────────────────────────────
export function agruparPorEntidad(recs: RecoJefe[]): Map<string, RecoJefe[]> {
  const g = new Map<string, RecoJefe[]>();
  for (const r of recs) {
    const k = entityKey(r) ?? `sin-entidad:${r.id}`;
    (g.get(k) ?? g.set(k, []).get(k)!).push(r);
  }
  return g;
}

// ─── Detectar conflictos (determinístico) ────────────────────────────────────
export function detectarConflictos(recs: RecoJefe[]): Conflicto[] {
  const conflictos: Conflicto[] = [];

  // Regla A: recomendación ACCIONABLE con confianza insuficiente → no ejecutar.
  for (const r of recs) {
    if (r.action_tool && r.confianza != null && r.confianza < UMBRAL_CONFIANZA) {
      conflictos.push({
        tipo: "evidencia_insuficiente",
        entity: entityKey(r),
        motivo: `evidencia insuficiente (confianza ${r.confianza}%) para ejecutar "${r.action_tool}"`,
        recomendaciones: [r.id],
        agentes: Array.from(new Set(r.agentes ?? [r.agent_id])),
      });
    }
  }

  // Regla B: sobre la misma entidad, señal de BAJAR precio + señal de margen/
  // rentabilidad → señales contradictorias.
  for (const [, grupo] of agruparPorEntidad(recs)) {
    if (grupo.length < 2) continue;
    const baja = grupo.filter(r => r.metadata?.direccion === "baja" || /baj/i.test(r.tipo));
    const margen = grupo.filter(r => /margen|rentabil/i.test(r.tipo) || /margen|rentabil/i.test(r.titulo));
    if (baja.length && margen.length) {
      const involucradas = Array.from(new Set([...baja, ...margen].map(r => r.id)));
      const agentes = Array.from(new Set([...baja, ...margen].flatMap(r => r.agentes ?? [r.agent_id])));
      conflictos.push({
        tipo: "contradiccion",
        entity: entityKey(grupo[0]!), // grupo tiene >= 2 elementos (guardado arriba)
        motivo: "señales contradictorias: bajar precio vs. margen/rentabilidad — no modificar todavía",
        recomendaciones: involucradas,
        agentes,
      });
    }
  }

  // Dedup de conflictos por (tipo, entity).
  const vistos = new Set<string>();
  return conflictos.filter(c => {
    const k = `${c.tipo}:${c.entity}`;
    if (vistos.has(k)) return false;
    vistos.add(k); return true;
  });
}

// ─── Priorizar (determinístico) ──────────────────────────────────────────────
// Orden: prioridad asc (1 = máx) → valor_esperado desc → severidad desc → id.
export function priorizar(recs: RecoJefe[]): RecoJefe[] {
  return [...recs].sort((a, b) => {
    const pa = a.prioridad ?? 99, pb = b.prioridad ?? 99;
    if (pa !== pb) return pa - pb;
    const va = a.valor_esperado ?? -1, vb = b.valor_esperado ?? -1;
    if (va !== vb) return vb - va;
    const sa = SEV_RANK[a.severidad], sb = SEV_RANK[b.severidad];
    if (sa !== sb) return sb - sa;
    return a.id - b.id;
  });
}

export function conteosPorSeveridad(recs: RecoJefe[]) {
  return {
    criticas: recs.filter(r => r.severidad === "critica").length,
    importantes: recs.filter(r => r.severidad === "importante").length,
    oportunidades: recs.filter(r => r.severidad === "oportunidad").length,
  };
}

// ─── Resumen determinístico (fallback sin IA) ────────────────────────────────
function ars(n: number | null): string {
  if (n == null) return "sin estimación";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

export function textoPlantilla(
  conteos: ResumenJefe["conteos"], seleccionadas: RecoJefe[], conflictos: Conflicto[]
): string {
  if (!seleccionadas.length && !conflictos.length) {
    return "Sin recomendaciones para priorizar hoy. Todo en orden.";
  }
  const L: string[] = [];
  L.push(`Hoy: ${conteos.criticas} crítica(s), ${conteos.importantes} importante(s), ${conteos.oportunidades} oportunidad(es).`);
  seleccionadas.forEach((r, i) => {
    const imp = r.valor_esperado != null ? ` — potencial ${ars(r.valor_esperado)}`
      : r.impacto_estimado != null ? ` — impacto ${ars(r.impacto_estimado)}` : "";
    L.push(`Prioridad ${i + 1}: ${r.titulo}${imp}${r.confianza != null ? ` (confianza ${r.confianza}%)` : ""}.`);
  });
  for (const c of conflictos) {
    L.push(`⚠️ ${c.motivo}. Fuentes: ${c.agentes.join(", ") || "—"}.`);
  }
  return L.join("\n");
}

// ─── Orquestación pura ────────────────────────────────────────────────────────
export function analizar(recsRaw: RecoJefe[], topN = 5): ResumenJefe {
  const consideradas = recsRaw.map(r => r.id);
  if (!recsRaw.length) {
    return {
      conteos: { criticas: 0, importantes: 0, oportunidades: 0 },
      conflictos: [], seleccionadas: [], consideradas: [], agentes: [],
      resultado: "sin_datos",
      textoPlantilla: textoPlantilla({ criticas: 0, importantes: 0, oportunidades: 0 }, [], []),
    };
  }
  const recs = deduplicar(recsRaw);
  const conflictos = detectarConflictos(recs);
  // Recomendaciones en conflicto NO se seleccionan como prioridad accionable
  // (se muestran aparte como señal), para no empujar una acción no respaldada.
  const enConflicto = new Set(conflictos.flatMap(c => c.recomendaciones));
  const priorizadas = priorizar(recs.filter(r => !enConflicto.has(r.id)));
  const seleccionadas = priorizadas.slice(0, topN);
  const conteos = conteosPorSeveridad(recs);
  const agentes = Array.from(new Set(recs.flatMap(r => r.agentes ?? [r.agent_id])));
  return {
    conteos, conflictos, seleccionadas, consideradas, agentes,
    resultado: "ok",
    textoPlantilla: textoPlantilla(conteos, seleccionadas, conflictos),
  };
}
