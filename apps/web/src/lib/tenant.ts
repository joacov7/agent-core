import type { TenantCtx } from "@agent-core/contracts";
import { LINEAS, leerCookie, resolverLinea } from "./lineas";

/**
 * Costura de resolución de tenant. El Core falla cerrado sin `TenantCtx`, así que
 * cada request lo necesita. Cada LÍNEA de negocio (internet, seguridad) es un tenant.
 *
 * DEV (lo que corre hoy, sin claves): la línea sale del header `x-tenant-id` (pruebas) o de la
 * cookie `linea` (la que pone el selector de la app); si no hay, la primera. Un valor desconocido
 * se ignora: nunca crea un tenant nuevo.
 *
 * PROD con Clerk: reemplazá el cuerpo por el `orgId` de la sesión —
 *   import { auth } from "@clerk/nextjs/server";
 *   const { orgId } = await auth();
 *   return { tenantId: orgId!, requestId: crypto.randomUUID(), now: () => new Date() };
 */
export function tenantPorDefecto(): string {
  return LINEAS[0]!.tenantId;
}

export function resolveTenant(req: { headers: { get(name: string): string | null } }): TenantCtx {
  const linea = resolverLinea(LINEAS, {
    tenantId: req.headers.get("x-tenant-id"),
    cookie: leerCookie(req.headers.get("cookie"), "linea"),
  });
  return { tenantId: linea.tenantId, requestId: crypto.randomUUID(), now: () => new Date() };
}

/** Para Server Components (que no reciben un `Request`): la línea a partir del valor de la cookie `linea`. */
export function tenantDeCookie(valor: string | undefined): TenantCtx {
  return { tenantId: resolverLinea(LINEAS, { cookie: valor ?? null }).tenantId };
}
