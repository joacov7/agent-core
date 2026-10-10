import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { servicio } from "@/lib/app";

export const dynamic = "force-dynamic";

/** POST /api/run → corre los agentes encendidos del tenant y devuelve lo ejecutado. */
export async function POST(req: Request) {
  const ctx = resolveTenant(req);
  const res = await servicio.correr(ctx);
  return NextResponse.json({
    ejecutados: res.ejecutados.map((e) => ({
      agentId: e.agentId, autonomia: e.autonomia, plan: e.plan, recomendaciones: e.recomendaciones.length,
    })),
    total: res.recomendaciones.length,
  });
}
