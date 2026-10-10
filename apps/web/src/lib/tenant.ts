import type { TenantCtx } from "@agent-core/contracts";

/**
 * Costura de resolución de tenant. El Core falla cerrado sin `TenantCtx`, así que
 * cada request lo necesita.
 *
 * DEV (lo que corre hoy, sin claves): lee el header `x-tenant-id`, o `DEV_TENANT`,
 * o "demo".
 *
 * PROD con Clerk: reemplazá el cuerpo por el `orgId` de la sesión —
 *   import { auth } from "@clerk/nextjs/server";
 *   const { orgId } = await auth();
 *   return { tenantId: orgId!, requestId: crypto.randomUUID(), now: () => new Date() };
 */
export function resolveTenant(req: { headers: { get(name: string): string | null } }): TenantCtx {
  const tenantId = req.headers.get("x-tenant-id") ?? process.env.DEV_TENANT ?? "demo";
  return { tenantId, requestId: crypto.randomUUID(), now: () => new Date() };
}
