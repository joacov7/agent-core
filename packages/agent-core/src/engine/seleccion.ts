// ─── Selección de agentes por tenant ─────────────────────────────────────────
// Combina la ACTIVACIÓN (qué está disponible: capacidades + cadencia) con la CONFIG
// por tenant (qué está encendido, con qué autonomía) para decidir qué corre de
// verdad. La activación dice "puede"; la config dice "quiero". Determinístico.

import type {
  AgentManifest, AgenteConfig, AutonomyMode, CoreStore, TenantCtx,
} from "@agent-core/contracts";
import { esActivable, type CapacidadesApp } from "../activacion/index.js";

const ORDEN_AUTONOMIA: AutonomyMode[] = ["manual", "assisted", "autonomous"];

/** Autonomía efectiva: la elegida, nunca por encima del máximo declarado en el manifest. */
export function autonomiaEfectiva(elegida: AutonomyMode, maxima: AutonomyMode): AutonomyMode {
  return ORDEN_AUTONOMIA.indexOf(elegida) <= ORDEN_AUTONOMIA.indexOf(maxima) ? elegida : maxima;
}

/** Qué hacer con un agente disponible que no tiene config guardada. */
export type PorDefecto = "encendido" | "apagado";

export interface AgenteSeleccionado<T> {
  agent: T;
  /** Autonomía efectiva con la que debe correr (ya acotada al máximo del manifest). */
  autonomia: AutonomyMode;
  plan?: string;
  config?: Record<string, unknown>;
}

/**
 * Resuelve la selección (pura, sin DB): de los agentes ACTIVABLES en la app, devuelve
 * los que están ENCENDIDOS según `configs`, cada uno con su autonomía efectiva, plan y
 * ajustes. Un agente activable sin config usa `pordefecto` (default `"apagado"`:
 * fail-closed, el usuario lo enciende explícitamente).
 */
export function resolverSeleccion<T extends { manifest: AgentManifest }>(
  catalogo: T[], app: CapacidadesApp, configs: AgenteConfig[],
  opts: { pordefecto?: PorDefecto } = {},
): AgenteSeleccionado<T>[] {
  const pordefecto = opts.pordefecto ?? "apagado";
  const porId = new Map(configs.map((c) => [c.agentId, c]));
  const out: AgenteSeleccionado<T>[] = [];

  for (const a of catalogo) {
    if (!esActivable(a.manifest, app)) continue;
    const cfg = porId.get(a.manifest.id);
    const encendido = cfg ? cfg.encendido : pordefecto === "encendido";
    if (!encendido) continue;

    const autonomia = autonomiaEfectiva(
      cfg?.autonomia ?? a.manifest.autonomiaMaxima, a.manifest.autonomiaMaxima,
    );
    const sel: AgenteSeleccionado<T> = { agent: a, autonomia };
    if (cfg?.plan !== undefined) sel.plan = cfg.plan;
    if (cfg?.config !== undefined) sel.config = cfg.config;
    out.push(sel);
  }
  return out;
}

/** Igual que `resolverSeleccion`, pero leyendo la config del `CoreStore` (o `[]` si no la persiste). */
export async function seleccionDeStore<T extends { manifest: AgentManifest }>(
  catalogo: T[], app: CapacidadesApp, ctx: TenantCtx, store: CoreStore,
  opts: { pordefecto?: PorDefecto } = {},
): Promise<AgenteSeleccionado<T>[]> {
  const configs = store.agentConfig ? await store.agentConfig.list(ctx) : [];
  return resolverSeleccion(catalogo, app, configs, opts);
}
