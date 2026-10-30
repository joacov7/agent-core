// Líneas de negocio de la app. Cada línea es su PROPIO TENANT (su adapter, su configuración de
// agentes, su bandeja y sus avisos): internet y seguridad no se mezclan, así cobros y morosidad
// quedan solo en internet. Puro (sin Next): se testea solo.

export interface Linea {
  id: "demo" | "internet" | "seguridad";
  tenantId: string;
  nombre: string;
  icono: string;
}

type Env = Record<string, string | undefined>;
const prendido = (v: string | undefined) => ["on", "1", "true", "si", "sí"].includes((v ?? "").trim().toLowerCase());

/**
 * Qué líneas hay, según el entorno:
 *  - sin `WISP_DATABASE_URL`: una sola, "demo" (datos de ejemplo).
 *  - con ella: **internet** (`WISP_TENANT`, default "guaynet"; `DEV_TENANT` lo pisa) y, con
 *    `SEGURIDAD=on`, **seguridad** (`SEGURIDAD_TENANT`, default "guaynet-seguridad").
 * La primera es la línea por defecto.
 */
export function leerLineas(env: Env): Linea[] {
  const dev = env.DEV_TENANT?.trim();
  if (!env.WISP_DATABASE_URL?.trim()) return [{ id: "demo", tenantId: dev || "demo", nombre: "Demo", icono: "🧪" }];

  const internet: Linea = { id: "internet", tenantId: dev || env.WISP_TENANT?.trim() || "guaynet", nombre: "Internet", icono: "🌐" };
  if (!prendido(env.SEGURIDAD)) return [internet];

  const tenantSeguridad = env.SEGURIDAD_TENANT?.trim() || "guaynet-seguridad";
  // Dos líneas con el mismo tenant compartirían bandeja y configuración: es justo lo que se quiere evitar.
  if (tenantSeguridad === internet.tenantId) {
    throw new Error(`SEGURIDAD_TENANT ("${tenantSeguridad}") no puede ser igual al tenant de internet: cada línea necesita el suyo.`);
  }
  return [internet, { id: "seguridad", tenantId: tenantSeguridad, nombre: "Seguridad", icono: "🛡️" }];
}

/** Valor de una cookie en un header `Cookie`. */
export function leerCookie(header: string | null | undefined, nombre: string): string | undefined {
  if (!header) return undefined;
  for (const par of header.split(";")) {
    const i = par.indexOf("=");
    if (i > 0 && par.slice(0, i).trim() === nombre) {
      try { return decodeURIComponent(par.slice(i + 1).trim()); }
      catch { return undefined; } // cookie mal formada (la controla el cliente): se ignora, no tira el request
    }
  }
  return undefined;
}

/**
 * Línea de un request. Prioridad: header `x-tenant-id` (para pruebas), cookie `linea` (la que elige
 * el selector) y, si no hay o no es una línea conocida, la primera. Un valor desconocido NUNCA
 * crea un tenant nuevo: se ignora.
 */
export function resolverLinea(lineas: Linea[], pedido: { tenantId?: string | null; cookie?: string | null }): Linea {
  const porTenant = pedido.tenantId ? lineas.find((l) => l.tenantId === pedido.tenantId) : undefined;
  const porCookie = pedido.cookie ? lineas.find((l) => l.id === pedido.cookie) : undefined;
  return porTenant ?? porCookie ?? lineas[0]!;
}

export const LINEAS: Linea[] = leerLineas(process.env);
