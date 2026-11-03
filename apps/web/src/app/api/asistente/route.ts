import { exigirSesion } from "@/lib/auth";
import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { estadoAvisos } from "@/lib/avisos";

export const dynamic = "force-dynamic";

/** GET /api/asistente → estado de los avisos (sin token, chat ids ni detalles de errores). */
export async function GET(req: Request) {
  const sinSesion = await exigirSesion(req);
  if (sinSesion) return sinSesion;
  return NextResponse.json(await estadoAvisos(resolveTenant(req)));
}
