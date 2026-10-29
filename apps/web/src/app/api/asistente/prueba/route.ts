import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { enviarPrueba } from "@/lib/avisos";

export const dynamic = "force-dynamic";

/** POST /api/asistente/prueba → manda un mensaje de prueba por Telegram (máx. uno cada 30 s). */
export async function POST(req: Request) {
  const r = await enviarPrueba(resolveTenant(req));
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
