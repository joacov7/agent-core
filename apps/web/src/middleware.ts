import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, decidirAcceso, leerAuth } from "@/lib/auth-sesion";

/**
 * Puerta de entrada: nada se sirve sin sesión, salvo la pantalla de ingreso y su API. Corre en el runtime Edge, por eso
 * solo usa `lib/auth-sesion` (Web Crypto, sin Node). Si falta la configuración de la clave, falla CERRADO: la app no
 * sirve nada y explica qué falta. Cada ruta de la API vuelve a verificar (`exigirSesion`): esta no es la única barrera.
 */
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * URL ABSOLUTA de /login: el runtime de Next rechaza (500) un `Location` relativo en la respuesta de un middleware. Se arma con el
 * host que usó el navegador (encabezado `Host` o el de un proxy), validado, y no con el que Next crea tener (0.0.0.0, localhost…),
 * para que el usuario vuelva a la misma dirección por la que entró.
 */
export function urlDeLogin(req: NextRequest, destino: string): string {
  const crudo = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const host = crudo && /^[A-Za-z0-9.\-]+(:\d{1,5})?$|^\[[0-9A-Fa-f:]+\](:\d{1,5})?$/.test(crudo) ? crudo : req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ? "https" : req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}/login?next=${encodeURIComponent(destino)}`;
}

export async function middleware(req: NextRequest) {
  const d = await decidirAcceso(leerAuth(process.env), {
    path: req.nextUrl.pathname,
    search: req.nextUrl.search,
    cookie: req.cookies.get(COOKIE_SESION)?.value,
    ahora: Date.now(),
  });
  switch (d.tipo) {
    case "pasa":
      return NextResponse.next();
    case "login":
      return new NextResponse(null, { status: 307, headers: { location: urlDeLogin(req, d.destino), "cache-control": "no-store" } });
    case "no_autorizado":
      return NextResponse.json({ error: "Necesitás iniciar sesión.", causa: "sin_sesion" }, { status: 401, headers: { "cache-control": "no-store" } });
    case "sin_configurar":
      console.error(`[auth] pedido rechazado: acceso sin configurar. ${d.motivo}`);
      return d.api
        ? NextResponse.json({ error: "El acceso no está configurado.", causa: "sin_configurar" }, { status: 503, headers: { "cache-control": "no-store" } })
        : new NextResponse(
            `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso sin configurar</title>` +
            `<body style="font-family:system-ui,sans-serif;background:#0e1315;color:#e7ecee;max-width:640px;margin:48px auto;padding:0 20px;line-height:1.5">` +
            `<h1 style="font-size:22px">🔒 Falta configurar el acceso</h1>` +
            `<p>Por seguridad, la app no se muestra hasta que tenga una clave.</p>` +
            `<p style="color:#e0685a">${escapar(d.motivo)}</p>` +
            `<p>En el servidor: <code>cd ~/agent-core/apps/web && npm run auth:hash</code>, pegá la línea <code>AUTH_CLAVE_HASH=…</code> en el <code>.env</code> y reiniciá (<code>sudo systemctl restart agent-core</code>).</p>` +
            `<p style="color:#a3b0b6;font-size:14px">Solo para una demo local, sin datos reales: <code>AUTH=off</code> en el <code>.env</code>.</p>`,
            { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
          );
  }
}

// Todo salvo los archivos estáticos de Next (los necesita la propia pantalla de ingreso).
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
