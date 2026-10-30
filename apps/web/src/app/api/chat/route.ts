import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { servicioDe } from "@/lib/app";
import { esError } from "@/lib/errores";

export const dynamic = "force-dynamic";

const error = (mensaje: string, status: number, causa?: string) =>
  NextResponse.json({ error: mensaje, ...(causa ? { causa } : {}) }, { status });

/** POST /api/chat → { agentId, messages: [{role:"user"|"assistant", content}] } → { respuesta, modelo, uso }. */
export async function POST(req: Request) {
  const ctx = resolveTenant(req);
  let body: { agentId?: unknown; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return error("El cuerpo tiene que ser JSON.", 400);
  }
  if (typeof body.agentId !== "string") return error("Falta agentId.", 400);

  try {
    return NextResponse.json(await servicioDe(ctx.tenantId).chatear(ctx, body.agentId, body.messages as never));
  } catch (e) {
    if (esError(e, "ErrorDeValidacion")) return error(e.message, 400);
    if (esError(e, "ErrorIANoDisponible")) return error(e.message, 503, "sin_ia");
    if (esError(e, "PresupuestoExcedidoError")) return error("Se alcanzó el tope de gasto de IA de este tenant.", 429, "presupuesto");
    if (esError(e, "ProveedorIAError")) {
      // El detalle (URL del modelo, motivo) queda en el log del server, no en la respuesta.
      console.error("[chat] proveedor de IA:", e.message);
      const causa = (e as Error & { causa?: string }).causa;
      if (causa === "inalcanzable") return error("No puedo conectar con el modelo de IA. ¿Está corriendo? (con Ollama: `ollama serve`).", 503, causa);
      if (causa === "timeout") return error("El modelo tardó demasiado en responder. Probá con un mensaje más corto o un modelo más liviano.", 504, causa);
      return error("El modelo de IA devolvió un error.", 502, causa);
    }
    throw e;
  }
}
