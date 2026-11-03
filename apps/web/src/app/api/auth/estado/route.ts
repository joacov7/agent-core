import { authRuntime } from "@/lib/auth";
import { COOKIE_SESION, leerCookie, sesionValida } from "@/lib/auth-sesion";

export const dynamic = "force-dynamic";

/** GET /api/auth/estado → si la app pide clave y si este navegador tiene sesión. Público: no devuelve nada que no sepa quien lo pide. */
export async function GET(req: Request) {
  const { cfg } = authRuntime();
  const activo = cfg.modo !== "off";
  const autenticado = cfg.modo === "activo" && (await sesionValida(cfg, leerCookie(req.headers.get("cookie"), COOKIE_SESION), Date.now()));
  return new Response(JSON.stringify({ activo, autenticado, ...(autenticado && cfg.modo === "activo" ? { usuario: cfg.usuario } : {}) }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
