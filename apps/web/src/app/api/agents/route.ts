import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { servicio } from "@/lib/app";

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
  return NextResponse.json(await servicio.setAgente(ctx, cfg));
}
