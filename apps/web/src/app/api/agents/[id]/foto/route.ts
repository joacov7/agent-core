import { NextResponse } from "next/server";
import { catalogo } from "@agent-core/agents";
import { resolveTenant } from "@/lib/tenant";
import { esError } from "@/lib/errores";
import { almacenDesdeEnv, leerCuerpoAcotado, urlDeFoto } from "@/lib/fotos";

export const dynamic = "force-dynamic";

// Foto del agente, por línea (tenant). Sin login todavía (como el resto de la app): por eso todo se valida
// en lib/fotos.ts (tipo por bytes, tamaño acotado, rutas estrictas).
const almacen = almacenDesdeEnv(process.env);

const error = (mensaje: string, status: number) => NextResponse.json({ error: mensaje }, { status });
type Ctx = { params: Promise<{ id: string }> };
const existe = (id: string) => catalogo.some((a) => a.manifest.id === id);

/** GET → la imagen (404 si el agente no tiene). Lleva `nosniff` y una CSP vacía: aunque el archivo no fuera una imagen real, el navegador no la ejecuta. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!existe(id)) return error("Agente desconocido.", 404);
  const ctx = resolveTenant(req);
  const foto = almacen.leer(ctx.tenantId, id);
  if (!foto) return error("Este agente no tiene foto.", 404);
  const etag = `"${foto.version}"`;
  const comun = {
    etag,
    "cache-control": "private, no-cache", // siempre revalida (barato con ETag), así un cambio de foto se ve al instante
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: comun });
  return new Response(foto.bytes as BodyInit, { headers: { ...comun, "content-type": foto.mime, "content-length": String(foto.bytes.length) } });
}

/** PUT (el cuerpo es la imagen cruda) → guarda o reemplaza la foto. Devuelve la URL nueva. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!existe(id)) return error("Agente desconocido.", 404);
  const ctx = resolveTenant(req);
  try {
    const bytes = await leerCuerpoAcotado(req);
    await almacen.guardar(ctx.tenantId, id, bytes);
    const fotoUrl = almacen.urls(ctx.tenantId)[id] ?? urlDeFoto(id, Date.now());
    return NextResponse.json({ fotoUrl });
  } catch (e) {
    if (esError(e, "ErrorDeFoto")) return error(e.message, (e as Error & { status: number }).status);
    throw e;
  }
}

/** DELETE → vuelve al avatar generado. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!existe(id)) return error("Agente desconocido.", 404);
  const ctx = resolveTenant(req);
  try {
    await almacen.borrar(ctx.tenantId, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (esError(e, "ErrorDeFoto")) return error(e.message, (e as Error & { status: number }).status);
    throw e;
  }
}
