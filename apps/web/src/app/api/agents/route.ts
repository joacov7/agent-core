import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { servicio } from "@/lib/app";
import { ErrorDeValidacion } from "@/lib/service";

export const dynamic = "force-dynamic";

/** GET /api/agents → lista de agentes con disponibilidad + config del tenant. */
export async function GET(req: Request) {
  const ctx = resolveTenant(req);
  return NextResponse.json(await servicio.listarAgentes(ctx));
}

/** PUT /api/agents → enciende/apaga/ajusta un agente (body: AgenteConfigInput). */
export async function PUT(req: Request) {
  const ctx = resolveTenant(req);
  const cfg = await req.json();
  try {
    return NextResponse.json(await servicio.setAgente(ctx, cfg));
  } catch (e) {
    if (e instanceof ErrorDeValidacion) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
