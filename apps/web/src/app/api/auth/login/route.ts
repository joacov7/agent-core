import { authRuntime } from "@/lib/auth";
import { cookieDeSesion, destinoSeguro, esHttps, firmarSesion } from "@/lib/auth-sesion";
import { mismoUsuario, verificarClave } from "@/lib/auth-clave";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // scrypt vive en node:crypto

const json = (cuerpo: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });

/** POST /api/auth/login → { usuario, clave, next? } → { ok, destino } y la cookie de sesión. */
export async function POST(req: Request) {
  const { cfg, limitador } = authRuntime();
  if (cfg.modo === "off") return json({ ok: true, destino: "/" }, 200);
  if (cfg.modo === "sin_configurar") return json({ error: "El acceso no está configurado en el servidor.", causa: "sin_configurar" }, 503);

  // Un ingreso solo se acepta desde la propia app: si el navegador declara otro origen, no es nuestro formulario.
  const origen = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origen) {
    let mismo = false;
    try { mismo = new URL(origen).host === host; } catch { /* origen ilegible → no es el mismo */ }
    if (!mismo) return json({ error: "Origen no permitido." }, 403);
  }

  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > 4096) return json({ error: "Pedido demasiado grande." }, 413);

  // Con el freno activo no se verifica nada (así el bloqueo tampoco sirve para adivinar).
  const cupo = limitador.intento();
  if (!cupo.ok) {
    return json({ error: `Demasiados intentos fallidos. Probá de nuevo en ${Math.ceil(cupo.reintentarEnSeg / 60)} min.`, causa: "demasiados_intentos" }, 429, { "retry-after": String(cupo.reintentarEnSeg) });
  }

  let body: { usuario?: unknown; clave?: unknown; next?: unknown };
  try { body = await req.json(); } catch { return json({ error: "El cuerpo tiene que ser JSON." }, 400); }
  if (typeof body.usuario !== "string" || typeof body.clave !== "string") return json({ error: "Faltan el usuario y la clave." }, 400);

  // Las dos verificaciones se hacen SIEMPRE (sin cortocircuito): no se filtra por tiempo si falló el usuario o la clave.
  const claveOk = verificarClave(body.clave, cfg.material, cfg.enClaro);
  const usuarioOk = mismoUsuario(body.usuario, cfg.usuario);
  if (!(claveOk && usuarioOk)) {
    limitador.falla();
    console.warn("[auth] intento de ingreso fallido");
    return json({ error: "Usuario o clave incorrectos." }, 401); // mismo mensaje para los dos casos
  }

  limitador.exito();
  const sesion = await firmarSesion(cfg, Date.now());
  return json({ ok: true, destino: destinoSeguro(typeof body.next === "string" ? body.next : null) }, 200, {
    "set-cookie": cookieDeSesion(sesion, cfg.horas, esHttps(req)),
  });
}
