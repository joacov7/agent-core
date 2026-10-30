import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { servicioDe } from "@/lib/app";

export const dynamic = "force-dynamic";

/** POST /api/run → corre los agentes encendidos del tenant y devuelve lo ejecutado. */
export async function POST(req: Request) {
  const ctx = resolveTenant(req);
  let res;
  try {
    res = await servicioDe(ctx.tenantId).correr(ctx);
  } catch (e) {
    // Un fallo de la fuente de datos (p.ej. la base del WISP caída) no filtra detalles al cliente.
    console.error("[run] falló la corrida:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pude correr el equipo: falló la lectura de los datos. Revisá que la base esté disponible." }, { status: 502 });
  }
  return NextResponse.json({
    ejecutados: res.ejecutados.map((e) => ({
      agentId: e.agentId, autonomia: e.autonomia, plan: e.plan, recomendaciones: e.recomendaciones.length,
    })),
    total: res.recomendaciones.length,
  });
}
