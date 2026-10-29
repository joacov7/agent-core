// agentId → nombre del rol ("cobros" → "Cobros"), para redactar "Lou · Cobros". Se arma perezosamente
// desde el catálogo (import dinámico evita el ciclo catalogo → asistente → catalogo).
import type { Agent } from "@agent-core/contracts";

let cache: Record<string, string> | undefined;
let fuente: Agent[] | undefined;

/** El catálogo se registra una vez desde `catalogo.ts`. */
export function registrarCatalogoParaRoles(catalogo: Agent[]): void { fuente = catalogo; cache = undefined; }

export function catalogoRoles(): Record<string, string> {
  if (!cache) cache = Object.fromEntries((fuente ?? []).map((a) => [a.manifest.id, a.manifest.nombre]));
  return cache;
}
