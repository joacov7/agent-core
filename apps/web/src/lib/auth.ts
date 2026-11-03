import { COOKIE_SESION, leerAuth, leerCookie, sesionValida, type ConfigAuth } from "./auth-sesion";
import { crearLimitador, type Limitador } from "./limitador";

/**
 * Estado de acceso del proceso (Node): la configuración leída del entorno y el freno a los intentos fallidos.
 * Singleton en `globalThis` por lo mismo que el resto (Next compila cada ruta como bundle propio; sin esto, cada
 * una tendría su propio contador de intentos y el freno no frenaría nada).
 */
interface RuntimeAuth { cfg: ConfigAuth; limitador: Limitador }
const g = globalThis as unknown as { __auth?: RuntimeAuth };

export const INTENTOS_MAX = 10;
export const VENTANA_INTENTOS_MS = 10 * 60_000;

export function authRuntime(env: Record<string, string | undefined> = process.env): RuntimeAuth {
  return (g.__auth ??= { cfg: leerAuth(env), limitador: crearLimitador({ max: INTENTOS_MAX, ventanaMs: VENTANA_INTENTOS_MS }) });
}

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * Segunda barrera de las rutas de la API (la primera es el middleware). Devuelve la respuesta a mandar si NO hay una sesión
 * válida, o `null` si se puede seguir. Cada ruta lo llama primero: así, aunque algún día el middleware no se ejecutara
 * (un bug de Next, una ruta mal excluida), ningún dato sale sin sesión.
 */
export async function exigirSesion(req: Request): Promise<Response | null> {
  const { cfg } = authRuntime();
  if (cfg.modo === "off") return null;
  if (cfg.modo === "sin_configurar") return json({ error: "El acceso no está configurado.", causa: "sin_configurar" }, 503);
  const ok = await sesionValida(cfg, leerCookie(req.headers.get("cookie"), COOKIE_SESION), Date.now());
  return ok ? null : json({ error: "Necesitás iniciar sesión.", causa: "sin_sesion" }, 401);
}

/** Qué dice el log al arrancar sobre el acceso (para que un `AUTH=off` o una clave en claro no pasen desapercibidos). */
export function resumenAuth(cfg: ConfigAuth): { nivel: "info" | "warn" | "error"; mensaje: string } {
  switch (cfg.modo) {
    case "off": return { nivel: "warn", mensaje: "[auth] AUTH=off: la app NO pide clave. Cualquiera que llegue al puerto puede entrar." };
    case "sin_configurar": return { nivel: "error", mensaje: `[auth] SIN CONFIGURAR, no se sirve nada hasta arreglarlo: ${cfg.motivo}` };
    case "activo": return cfg.enClaro
      ? { nivel: "warn", mensaje: `[auth] acceso protegido (usuario "${cfg.usuario}", sesión ${cfg.horas} h), pero AUTH_CLAVE está en claro: mejor usar AUTH_CLAVE_HASH (npm run auth:hash).` }
      : { nivel: "info", mensaje: `[auth] acceso protegido (usuario "${cfg.usuario}", sesión ${cfg.horas} h).` };
  }
}
