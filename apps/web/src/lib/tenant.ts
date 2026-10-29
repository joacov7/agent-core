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
/** Tenant por defecto: `DEV_TENANT`; con el adapter WISP activo, `WISP_TENANT` (default "guaynet"); si no, "demo". */
export function tenantPorDefecto(): string {
  if (process.env.DEV_TENANT) return process.env.DEV_TENANT;
  return process.env.WISP_DATABASE_URL ? (process.env.WISP_TENANT || "guaynet") : "demo";
}

export function resolveTenant(req: { headers: { get(name: string): string | null } }): TenantCtx {
  const tenantId = req.headers.get("x-tenant-id") ?? tenantPorDefecto();
  return { tenantId, requestId: crypto.randomUUID(), now: () => new Date() };
}
