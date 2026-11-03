import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { hashearClave } from "../../scripts/auth-hash.mjs";
import { exigirSesion, resumenAuth } from "./auth";
import { COOKIE_SESION, firmarSesion, leerAuth, sesionValida, type ConfigAuth } from "./auth-sesion";
import { crearLimitador } from "./limitador";
import { POST as login } from "../app/api/auth/login/route";
import { POST as logout } from "../app/api/auth/logout/route";
import { GET as estado } from "../app/api/auth/estado/route";
import { config as configMiddleware, middleware, urlDeLogin } from "../middleware";
import { NextRequest } from "next/server";

const CLAVE = "clave larga de prueba";
const g = globalThis as unknown as { __auth?: unknown };
const activo = (): Extract<ConfigAuth, { modo: "activo" }> => leerAuth({ AUTH_CLAVE_HASH: (hashearClave as (c: string) => string)(CLAVE), AUTH_USUARIO: "joaquin" }) as never;
let cfgActiva: Extract<ConfigAuth, { modo: "activo" }>;
beforeEach(() => { cfgActiva = activo(); g.__auth = { cfg: cfgActiva, limitador: crearLimitador({ max: 3, ventanaMs: 60_000 }) }; });
afterEach(() => { delete g.__auth; });

const post = (body: unknown, headers: Record<string, string> = {}, ruta = "/api/auth/login") =>
  new Request(`http://10.0.0.39:3100${ruta}`, { method: "POST", headers: { "content-type": "application/json", host: "10.0.0.39:3100", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const ok = { usuario: "joaquin", clave: CLAVE };

describe("POST /api/auth/login", () => {
  it("con las credenciales correctas entra: cookie firmada, HttpOnly + SameSite=Strict, y el destino pedido", async () => {
    const r = await login(post({ ...ok, next: "/consola" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, destino: "/consola" });
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/); expect(cookie).toMatch(/SameSite=Strict/); expect(cookie).not.toMatch(/Secure/);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const valor = cookie.split(";")[0]!.slice(COOKIE_SESION.length + 1);
    expect(await sesionValida(cfgActiva, valor, Date.now())).toBe(true);
  });
  it("por HTTPS la cookie lleva Secure", async () => {
    const r = await login(post(ok, { "x-forwarded-proto": "https" }));
    expect(r.headers.get("set-cookie")).toMatch(/; Secure/);
  });
  it("no deja redirigir a otro sitio", async () => {
    for (const next of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)"]) {
      expect(await (await login(post({ ...ok, next }))).json(), next).toEqual({ ok: true, destino: "/" });
    }
  });
  it("clave o usuario incorrectos: 401 con el MISMO mensaje (no se sabe cuál falló) y sin cookie", async () => {
    const mala = await login(post({ usuario: "joaquin", clave: "otra" }));
    const otroUsuario = await login(post({ usuario: "intruso", clave: CLAVE }));
    expect(mala.status).toBe(401); expect(otroUsuario.status).toBe(401);
    expect(await mala.json()).toEqual(await otroUsuario.json());
    expect(mala.headers.get("set-cookie")).toBeNull();
  });
  it("el usuario correcto con la clave de otro, o al revés, no entra", async () => {
    expect((await login(post({ usuario: "joaquin", clave: "" }))).status).toBe(401);
    expect((await login(post({ usuario: "", clave: CLAVE }))).status).toBe(401);
  });
  it("freno: tras 3 fallas bloquea con 429 + Retry-After, y mientras dura NO acepta ni la clave correcta", async () => {
    for (let i = 0; i < 3; i++) expect((await login(post({ usuario: "joaquin", clave: `mala${i}` }))).status).toBe(401);
    const bloqueado = await login(post(ok));
    expect(bloqueado.status).toBe(429);
    expect(Number(bloqueado.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await bloqueado.json() as { causa: string }).causa).toBe("demasiados_intentos");
    expect(bloqueado.headers.get("set-cookie")).toBeNull();
  });
  it("un ingreso correcto antes del tope limpia las fallas", async () => {
    await login(post({ usuario: "joaquin", clave: "x" })); await login(post({ usuario: "joaquin", clave: "y" }));
    expect((await login(post(ok))).status).toBe(200);
    await login(post({ usuario: "joaquin", clave: "z" })); await login(post({ usuario: "joaquin", clave: "w" }));
    expect((await login(post(ok))).status).toBe(200);
  });
  it("un pedido que dice venir de otro origen se rechaza (403); el del mismo origen pasa", async () => {
    expect((await login(post(ok, { origin: "http://evil.com" }))).status).toBe(403);
    expect((await login(post(ok, { origin: "not a url" }))).status).toBe(403);
    expect((await login(post(ok, { origin: "http://10.0.0.39:3100" }))).status).toBe(200);
  });
  it("cuerpo inválido: 400 (no JSON, campos que no son texto) y 413 si es enorme", async () => {
    expect((await login(post("{no es json"))).status).toBe(400);
    expect((await login(post({ usuario: 1, clave: 2 }))).status).toBe(400);
    expect((await login(post({ usuario: "joaquin" }))).status).toBe(400);
    expect((await login(post(ok, { "content-length": "999999" }))).status).toBe(413);
  });
  it("una clave gigante no se procesa (no hay DoS por hashear megabytes)", async () => {
    expect((await login(post({ usuario: "joaquin", clave: "a".repeat(5000) }))).status).toBe(401);
  });
  it("sin configurar: 503; con AUTH=off: no hace falta ingresar", async () => {
    g.__auth = { cfg: leerAuth({}), limitador: crearLimitador({ max: 3, ventanaMs: 1000 }) };
    expect((await login(post(ok))).status).toBe(503);
    g.__auth = { cfg: { modo: "off" }, limitador: crearLimitador({ max: 3, ventanaMs: 1000 }) };
    expect((await login(post(ok))).status).toBe(200);
  });
});

describe("logout y estado", () => {
  it("logout borra la cookie", async () => {
    const r = await logout(post({}, {}, "/api/auth/logout"));
    expect(r.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });
  it("estado: sin sesión no revela el usuario; con sesión, sí", async () => {
    const sin = await (await estado(new Request("http://x/api/auth/estado"))).json();
    expect(sin).toEqual({ activo: true, autenticado: false });
    const s = await firmarSesion(cfgActiva, Date.now());
    const con = await (await estado(new Request("http://x/api/auth/estado", { headers: { cookie: `${COOKIE_SESION}=${s}` } }))).json();
    expect(con).toEqual({ activo: true, autenticado: true, usuario: "joaquin" });
  });
});

describe("exigirSesion (segunda barrera de las rutas)", () => {
  const conCookie = async (extra = "") => new Request("http://x/api/agents", { headers: { cookie: `${COOKIE_SESION}=${await firmarSesion(cfgActiva, Date.now())}${extra}` } });
  it("sin cookie → 401; con una cookie falsa → 401; con sesión → null (puede seguir)", async () => {
    expect((await exigirSesion(new Request("http://x/api/agents")))!.status).toBe(401);
    expect((await exigirSesion(new Request("http://x/api/agents", { headers: { cookie: `${COOKIE_SESION}=falsa.falsa` } })))!.status).toBe(401);
    expect(await exigirSesion(await conCookie())).toBeNull();
  });
  it("sin configurar → 503; AUTH=off → null", async () => {
    g.__auth = { cfg: leerAuth({}), limitador: crearLimitador({ max: 1, ventanaMs: 1 }) };
    expect((await exigirSesion(new Request("http://x/api/agents")))!.status).toBe(503);
    g.__auth = { cfg: { modo: "off" }, limitador: crearLimitador({ max: 1, ventanaMs: 1 }) };
    expect(await exigirSesion(new Request("http://x/api/agents"))).toBeNull();
  });
  it("las respuestas de rechazo no se cachean ni filtran detalles", async () => {
    const r = (await exigirSesion(new Request("http://x/api/agents")))!;
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: "Necesitás iniciar sesión.", causa: "sin_sesion" });
  });
});

describe("resumenAuth (lo que dice el log al arrancar)", () => {
  it("avisa fuerte lo que importa", () => {
    expect(resumenAuth({ modo: "off" }).nivel).toBe("warn");
    expect(resumenAuth({ modo: "sin_configurar", motivo: "m" }).nivel).toBe("error");
    expect(resumenAuth({ ...cfgActiva, enClaro: true }).nivel).toBe("warn");
    expect(resumenAuth(cfgActiva)).toMatchObject({ nivel: "info" });
    expect(JSON.stringify(resumenAuth(cfgActiva))).not.toContain(cfgActiva.material); // nunca imprime el hash
  });
});

describe("cobertura: ninguna ruta queda sin protección", () => {
  const raiz = join(__dirname, "..", "app", "api");
  const rutas = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? rutas(p) : n === "route.ts" ? [p] : [];
  });
  const todas = rutas(raiz).map((p) => ({ p, rel: relative(raiz, p), src: readFileSync(p, "utf8") }));

  it("hay rutas, y las de /auth son las únicas públicas", () => {
    expect(todas.length).toBeGreaterThanOrEqual(11);
    expect(todas.filter((r) => r.rel.startsWith("auth")).map((r) => r.rel).sort()).toEqual(["auth/estado/route.ts", "auth/login/route.ts", "auth/logout/route.ts"]);
  });
  it("TODA función exportada (GET/POST/PUT/DELETE…) de las demás rutas llama a exigirSesion antes de hacer nada", () => {
    for (const { rel, src } of todas.filter((r) => !r.rel.startsWith("auth"))) {
      const handlers = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\(/g)];
      expect(handlers.length, rel).toBeGreaterThan(0);
      const llamadas = [...src.matchAll(/await exigirSesion\(req\)/g)];
      expect(llamadas.length, `${rel}: ${handlers.length} funciones, ${llamadas.length} verificaciones`).toBe(handlers.length);
      // y es lo PRIMERO que hace cada una
      for (const h of handlers) {
        const cuerpo = src.slice(h.index!, src.indexOf("exigirSesion", h.index!));
        expect(cuerpo.split("\n").length, `${rel} ${h[1]}: exigirSesion no es lo primero`).toBeLessThanOrEqual(2);
      }
    }
  });
  it("no hay otro método exportado distinto de función async (que se saltee el chequeo)", () => {
    for (const { rel, src } of todas.filter((r) => !r.rel.startsWith("auth"))) {
      expect(src, rel).not.toMatch(/export (const|function) (GET|POST|PUT|PATCH|DELETE)\b/);
    }
  });
  it("el middleware cubre la API y las páginas; solo excluye los estáticos de Next", () => {
    const m = new RegExp(`^${configMiddleware.matcher[0]!}$`);
    for (const p of ["/", "/consola", "/bandeja", "/login", "/api/agents", "/api/agents/cobros/foto", "/api/auth/login"]) expect(m.test(p), p).toBe(true);
    for (const p of ["/_next/static/chunks/a.js", "/_next/image", "/favicon.ico"]) expect(m.test(p), p).toBe(false);
  });
});

describe("middleware (decisión HTTP)", () => {
  const pedir = (ruta: string, cookie?: string) => middleware(new NextRequest(`http://10.0.0.39:3100${ruta}`, cookie ? { headers: { cookie: `${COOKIE_SESION}=${cookie}` } } : {}));
  beforeEach(() => { process.env.AUTH_CLAVE_HASH = (cfgActiva as { material: string }).material; process.env.AUTH_USUARIO = "joaquin"; delete process.env.AUTH; delete process.env.AUTH_CLAVE; });
  afterEach(() => { for (const k of ["AUTH_CLAVE_HASH", "AUTH_USUARIO", "AUTH", "AUTH_CLAVE"]) delete process.env[k]; });

  it("página sin sesión → 307 a /login?next=… con URL ABSOLUTA (Next rechaza un Location relativo con un 500)", async () => {
    const r = await pedir("/consola?x=1");
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("http://10.0.0.39:3100/login?next=%2Fconsola%3Fx%3D1");
  });
  it("urlDeLogin usa el host con el que entró el navegador, y no uno inventado", () => {
    const con = (headers: Record<string, string>) => urlDeLogin(new NextRequest("http://0.0.0.0:3100/x", { headers }), "/consola");
    expect(con({ host: "10.0.0.39:3100" })).toBe("http://10.0.0.39:3100/login?next=%2Fconsola");
    expect(con({ host: "panel.local", "x-forwarded-proto": "https" })).toBe("https://panel.local/login?next=%2Fconsola");
    expect(con({ host: "10.0.0.39:3100", "x-forwarded-host": "panel.local:8443" })).toBe("http://panel.local:8443/login?next=%2Fconsola");
    // un Host con basura (intento de inyectar en el Location) se ignora y se usa el de Next
    for (const malo of ["evil.com/x", "a b", "evil.com\\@x", "x@evil.com", "a:99999999", "evil.com#"]) {
      expect(con({ host: malo }), malo).toMatch(/^http:\/\/0\.0\.0\.0:3100\/login\?next=/);
    }
  });
  it("API sin sesión → 401 JSON; con sesión pasa", async () => {
    const r = await pedir("/api/agents");
    expect(r.status).toBe(401);
    const s = await firmarSesion(cfgActiva, Date.now());
    expect((await pedir("/api/agents", s)).headers.get("x-middleware-next")).toBe("1");
  });
  it("/login y su API se sirven sin sesión", async () => {
    expect((await pedir("/login")).headers.get("x-middleware-next")).toBe("1");
    expect((await pedir("/api/auth/login")).headers.get("x-middleware-next")).toBe("1");
  });
  it("sin configurar: 503 con la explicación (página) o JSON (API), y no se sirve nada", async () => {
    delete process.env.AUTH_CLAVE_HASH;
    const pagina = await pedir("/");
    expect(pagina.status).toBe(503);
    expect(await pagina.text()).toMatch(/Falta configurar el acceso/);
    expect((await pedir("/api/agents")).status).toBe(503);
    expect((await pedir("/login")).status).toBe(503);
  });
  it("el motivo se escapa en el HTML", async () => {
    process.env.AUTH_HORAS = '<img src=x onerror=alert(1)>';
    const t = await (await pedir("/")).text();
    delete process.env.AUTH_HORAS;
    expect(t).not.toContain("<img src=x");
    expect(t).toContain("&#60;img");
  });
  it("AUTH=off: pasa todo (y así consta en la configuración)", async () => {
    process.env.AUTH = "off";
    expect((await pedir("/api/agents")).headers.get("x-middleware-next")).toBe("1");
  });
});
