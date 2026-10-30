import { NextResponse } from "next/server";
import { LINEAS, resolverLinea, leerCookie } from "@/lib/lineas";

export const dynamic = "force-dynamic";

/** GET /api/lineas → las líneas de negocio (internet, seguridad…) y cuál está activa en este navegador. */
export async function GET(req: Request) {
  const actual = resolverLinea(LINEAS, { cookie: leerCookie(req.headers.get("cookie"), "linea") });
  return NextResponse.json({
    lineas: LINEAS.map((l) => ({ id: l.id, nombre: l.nombre, icono: l.icono })),
    actual: actual.id,
  });
}
