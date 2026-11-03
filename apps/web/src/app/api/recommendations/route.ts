import { exigirSesion } from "@/lib/auth";
import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { servicioDe } from "@/lib/app";

export const dynamic = "force-dynamic";

/** GET /api/recommendations → bandeja del tenant, ordenada por prioridad. */
export async function GET(req: Request) {
  const sinSesion = await exigirSesion(req);
  if (sinSesion) return sinSesion;
  const ctx = resolveTenant(req);
  return NextResponse.json(await servicioDe(ctx.tenantId).listarRecomendaciones(ctx));
}
