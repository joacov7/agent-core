/**
 * Acceso a la app: configuración, sesión firmada y decisión de a quién se deja pasar.
 *
 * SOLO usa Web Crypto y nada de Node: lo comparten el middleware (que corre en el runtime Edge) y las
 * rutas (Node), y no pueden divergir. Lo que necesita `node:crypto` (verificar la clave con scrypt) vive
 * aparte, en `auth-clave.ts`.
 *
 * Modelo: un único usuario (el dueño del negocio), definido en el `.env`. Falla CERRADO: si falta la
 * clave, la app no sirve nada (solo explica cómo configurarla); apagar el acceso requiere `AUTH=off`,
 * explícito. Sin usuarios múltiples ni roles todavía (ese es el camino a Clerk, ver README).
 */

export const COOKIE_SESION = "agentcore_sesion";
const VERSION = 1;
const HORAS_DEFECTO = 12;
const HORAS_MAX = 24 * 14;
const MIN_CLAVE = 10;

type Env = Record<string, string | undefined>;

export type ConfigAuth =
  | { modo: "off" }
  /** Falta algo para poder entrar: la app no sirve nada hasta que se arregle. `motivo` es para el dueño, no para la red. */
  | { modo: "sin_configurar"; motivo: string }
  | { modo: "activo"; usuario: string; horas: number; /** hash scrypt o clave en claro (esta última, desaconsejada) */ material: string; enClaro: boolean };

const prendido = (v: string | undefined) => ["on", "1", "true", "si", "sí", "yes"].includes((v ?? "").trim().toLowerCase());
const apagado = (v: string | undefined) => ["off", "0", "false", "no"].includes((v ?? "").trim().toLowerCase());

/** Lee la configuración de acceso del entorno. Nunca lanza: lo inválido deja la app cerrada, con un motivo claro. */
export function leerAuth(env: Env): ConfigAuth {
  if (apagado(env.AUTH)) return { modo: "off" };
  const usuario = env.AUTH_USUARIO?.trim() || "admin";
  const hash = env.AUTH_CLAVE_HASH?.trim();
  const claro = env.AUTH_CLAVE;
  const horasCrudas = env.AUTH_HORAS?.trim();
  const horas = horasCrudas ? Number(horasCrudas) : HORAS_DEFECTO;
  if (!Number.isFinite(horas) || horas < 1 || horas > HORAS_MAX) {
    return { modo: "sin_configurar", motivo: `AUTH_HORAS inválida ("${horasCrudas}"): tiene que estar entre 1 y ${HORAS_MAX}.` };
  }
  if (hash) {
    if (!/^scrypt:\d+:\d+:\d+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$/.test(hash)) {
      return { modo: "sin_configurar", motivo: "AUTH_CLAVE_HASH no tiene el formato esperado: generala de nuevo con `npm run auth:hash`." };
    }
    return { modo: "activo", usuario, horas, material: hash, enClaro: false };
  }
  if (claro !== undefined && claro !== "") {
    if (claro.length < MIN_CLAVE) return { modo: "sin_configurar", motivo: `AUTH_CLAVE es muy corta (mínimo ${MIN_CLAVE} caracteres).` };
    return { modo: "activo", usuario, horas, material: claro, enClaro: true };
  }
  return { modo: "sin_configurar", motivo: "Falta definir la clave de acceso: AUTH_CLAVE_HASH (recomendado, `npm run auth:hash`) o AUTH_CLAVE en el .env." };
}

// ── Sesión firmada ───────────────────────────────────────────────────────────────────────────────
const enc = new TextEncoder();
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64url = (s: string): Uint8Array<ArrayBuffer> | null => {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch { return null; }
};

/**
 * Clave de firma de las sesiones, derivada de la clave de acceso: no hay otro secreto que configurar, es estable
 * entre reinicios y **cambiar la clave cierra todas las sesiones abiertas**. Vive solo en el `.env` del servidor.
 */
async function claveDeFirma(material: string): Promise<CryptoKey> {
  const base = await crypto.subtle.digest("SHA-256", enc.encode(`agentcore-sesion-v${VERSION}\0${material}`));
  return crypto.subtle.importKey("raw", base, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

interface Carga { v: number; u: string; e: number }

export async function firmarSesion(cfg: Extract<ConfigAuth, { modo: "activo" }>, ahora: number): Promise<string> {
  const carga: Carga = { v: VERSION, u: cfg.usuario, e: ahora + cfg.horas * 3_600_000 };
  const cuerpo = b64url(enc.encode(JSON.stringify(carga)));
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", await claveDeFirma(cfg.material), enc.encode(cuerpo)));
  return `${cuerpo}.${b64url(firma)}`;
}

/** ¿La cookie es una sesión vigente, firmada por este servidor y del usuario configurado? Cualquier duda → `false`. */
export async function sesionValida(cfg: ConfigAuth, cookie: string | undefined, ahora: number): Promise<boolean> {
  if (cfg.modo === "off") return true;
  if (cfg.modo !== "activo" || !cookie || cookie.length > 1024) return false;
  const [cuerpo, firma, resto] = cookie.split(".");
  if (!cuerpo || !firma || resto !== undefined) return false;
  const firmaBytes = deB64url(firma);
  if (!firmaBytes) return false;
  const ok = await crypto.subtle.verify("HMAC", await claveDeFirma(cfg.material), firmaBytes, enc.encode(cuerpo)); // comparación en tiempo constante
  if (!ok) return false;
  const bytes = deB64url(cuerpo);
  if (!bytes) return false;
  try {
    const c = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Carga>;
    return c.v === VERSION && c.u === cfg.usuario && typeof c.e === "number" && c.e > ahora;
  } catch { return false; }
}

// ── Cookie ───────────────────────────────────────────────────────────────────────────────────────
/** Valor de una cookie en el header `Cookie`. */
export function leerCookie(header: string | null | undefined, nombre: string): string | undefined {
  if (!header) return undefined;
  for (const par of header.split(";")) {
    const i = par.indexOf("=");
    if (i > 0 && par.slice(0, i).trim() === nombre) return par.slice(i + 1).trim();
  }
  return undefined;
}

/**
 * `Set-Cookie` de la sesión. HttpOnly (el JavaScript de la página no la ve) y SameSite=Strict (el navegador no la manda en
 * pedidos que vienen de otro sitio: eso es lo que frena el CSRF). `Secure` solo si la conexión es HTTPS: en una red local
 * por HTTP, `Secure` haría que el navegador la descartara y nadie pudiera entrar.
 */
export function cookieDeSesion(valor: string, horas: number, https: boolean): string {
  return `${COOKIE_SESION}=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.round(horas * 3600)}${https ? "; Secure" : ""}`;
}
export const cookieBorrada = (https: boolean) => `${COOKIE_SESION}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${https ? "; Secure" : ""}`;

export const esHttps = (req: { url: string; headers: { get(n: string): string | null } }) =>
  req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" || req.url.startsWith("https:");

// ── Destino tras el login ────────────────────────────────────────────────────────────────────────
/** Solo rutas internas: `//evil.com`, `/\evil.com`, `https://…` o `javascript:` no pasan (redirección abierta). */
export function destinoSeguro(next: string | null | undefined): string {
  if (!next || next.length > 512 || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return "/";
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/api/auth")) return "/";
  return next;
}

// ── Decisión de acceso ───────────────────────────────────────────────────────────────────────────
/** Rutas que se sirven sin sesión: la pantalla de ingreso y su API. Todo lo demás exige sesión. */
export const esRutaPublica = (path: string) =>
  path === "/login" || path === "/api/auth/login" || path === "/api/auth/logout" || path === "/api/auth/estado";

export type Decision =
  | { tipo: "pasa" }
  | { tipo: "login"; destino: string }                          // página → redirigir a /login?next=…
  | { tipo: "no_autorizado" }                                   // API → 401 JSON
  | { tipo: "sin_configurar"; motivo: string; api: boolean };   // falla cerrado

export async function decidirAcceso(cfg: ConfigAuth, req: { path: string; search?: string; cookie?: string | undefined; ahora: number }): Promise<Decision> {
  if (cfg.modo === "off") return { tipo: "pasa" };
  const api = req.path.startsWith("/api/");
  if (cfg.modo === "sin_configurar") return { tipo: "sin_configurar", motivo: cfg.motivo, api };
  if (esRutaPublica(req.path)) return { tipo: "pasa" };
  if (await sesionValida(cfg, req.cookie, req.ahora)) return { tipo: "pasa" };
  return api ? { tipo: "no_autorizado" } : { tipo: "login", destino: destinoSeguro(`${req.path}${req.search ?? ""}`) };
}
