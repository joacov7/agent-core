import { cookieBorrada, esHttps } from "@/lib/auth-sesion";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout → borra la cookie de sesión (el navegador deja de mandarla). */
export async function POST(req: Request) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { "content-type": "application/json", "cache-control": "no-store", "set-cookie": cookieBorrada(esHttps(req)) },
  });
}
