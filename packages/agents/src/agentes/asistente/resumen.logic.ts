import type { Recomendacion, Severidad } from "@agent-core/contracts";
import { ESTADOS_VIVOS } from "@agent-core/core";

// ─── Redacción de los avisos del Asistente personal: lógica pura (sin red ni IA) ──────────────
// Resumen de la mañana y alertas urgentes a partir de las recomendaciones abiertas. Texto plano
// (el canal decide cómo mostrarlo). Por privacidad, NO incluye nombres de personas salvo que se
// pida (`incluirNombres`): los títulos de los agentes traen montos y tipos, no nombres.

export interface OpcionesAviso {
  /** "Hoy" en la zona del negocio, YYYY-MM-DD. */
  fecha: string;
  /** agentId → nombre propio ("Lou", o el alias del tenant). */
  nombres?: Record<string, string>;
  /** agentId → rol ("Cobros"). */
  roles?: Record<string, string>;
  /** Solo se usa con `incluirNombres`: id de la recomendación → nombre del titular. */
  titulares?: Record<string, string>;
  incluirNombres?: boolean;
  /** Link a la bandeja (opcional). */
  url?: string;
  /** Línea de negocio a la que pertenece el aviso ("🛡️ Seguridad"): va en el encabezado. */
  etiqueta?: string;
}

const ORDEN: Severidad[] = ["critica", "importante", "oportunidad"];
const ICONO: Record<Severidad, string> = { critica: "🔴", importante: "🟠", oportunidad: "🔵" };
const ETIQUETA: Record<Severidad, string> = { critica: "Críticas", importante: "Importantes", oportunidad: "Oportunidades" };
const MAX_AGENTES = 4;
const MAX_ALERTAS = 5;

/** Las que siguen vivas (sin resolver). */
export const abiertas = (recos: Recomendacion[]): Recomendacion[] => recos.filter((r) => ESTADOS_VIVOS.includes(r.estado));

/**
 * Clave estable de "este hallazgo" para no avisar dos veces de lo mismo, aunque el motor lo
 * refresque (cambia el título, p.ej. "hace 11 días" → "hace 12"). Sin dedupKey, se arma con lo que es.
 */
export function claveAviso(r: Recomendacion): string {
  return r.dedupKey ? `${r.agentId}|${r.dedupKey}` : `${r.agentId}|${r.tipo}|${r.refEntidad?.tipo ?? ""}:${r.refEntidad?.id ?? ""}`;
}

const plata = (n: number) => `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

function quien(r: Recomendacion, o: OpcionesAviso): string {
  const nombre = o.nombres?.[r.agentId];
  const rol = o.roles?.[r.agentId];
  return nombre && rol ? `${nombre} · ${rol}` : (nombre ?? rol ?? r.agentId);
}

const conTitular = (r: Recomendacion, o: OpcionesAviso): string => {
  const t = o.incluirNombres ? o.titulares?.[r.id] : undefined;
  return t ? `${r.titulo} — ${t}` : r.titulo;
};

const masUrgente = (a: Recomendacion, b: Recomendacion) => a.prioridad - b.prioridad || (b.impactoEstimado ?? 0) - (a.impactoEstimado ?? 0);

/** Resumen de la mañana. */
export function componerResumen(recos: Recomendacion[], o: OpcionesAviso): string {
  const vivas = abiertas(recos);
  const cab = `☀️ Buen día · resumen del ${diaMes(o.fecha)}${o.etiqueta ? ` · ${o.etiqueta}` : ""}`;
  const pie = o.url ? [`\nAbrí la bandeja: ${o.url}`] : [];
  if (vivas.length === 0) return [cab, "", "Todo tranquilo: no hay hallazgos abiertos.", ...pie].join("\n");

  const lineas: string[] = [cab];
  for (const sev of ORDEN) {
    const deSev = vivas.filter((r) => r.severidad === sev);
    if (deSev.length === 0) continue;
    lineas.push("", `${ICONO[sev]} ${ETIQUETA[sev]} (${deSev.length})`);

    const porAgente = new Map<string, Recomendacion[]>();
    for (const r of deSev) porAgente.set(r.agentId, [...(porAgente.get(r.agentId) ?? []), r].sort(masUrgente));
    const grupos = [...porAgente.values()].sort((a, b) => masUrgente(a[0]!, b[0]!) || b.length - a.length);

    for (const g of grupos.slice(0, MAX_AGENTES)) {
      const top = g[0]!;
      if (g.length <= 2) {
        for (const r of g) lineas.push(`• ${quien(r, o)}: ${conTitular(r, o)}`);
      } else {
        const total = g.reduce((s, r) => s + (r.impactoEstimado ?? 0), 0);
        lineas.push(`• ${quien(top, o)}: ${g.length} hallazgos${total > 0 ? `, ${plata(total)} en juego` : ""}`);
        lineas.push(`   Más urgente: ${conTitular(top, o)}`);
      }
    }
    if (grupos.length > MAX_AGENTES) lineas.push(`• …y ${grupos.length - MAX_AGENTES} agente(s) más`);
  }
  return [...lineas, ...pie].join("\n");
}

/** Aviso urgente: solo lo NUEVO y grave. `nuevas` ya viene filtrado por quien llama. */
export function componerAlerta(nuevas: Recomendacion[], o: OpcionesAviso): string {
  const orden = [...nuevas].sort(masUrgente);
  const lineas = [`🚨 Aviso urgente (${orden.length})${o.etiqueta ? ` · ${o.etiqueta}` : ""}`];
  for (const r of orden.slice(0, MAX_ALERTAS)) lineas.push(`• ${quien(r, o)}: ${conTitular(r, o)}`);
  if (orden.length > MAX_ALERTAS) lineas.push(`• …y ${orden.length - MAX_ALERTAS} más en la bandeja`);
  if (o.url) lineas.push(`\nBandeja: ${o.url}`);
  return lineas.join("\n");
}
