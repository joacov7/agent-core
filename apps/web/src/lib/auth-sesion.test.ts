import { describe, expect, it } from "vitest";
import {
  COOKIE_SESION, cookieBorrada, cookieDeSesion, decidirAcceso, destinoSeguro, esHttps, esRutaPublica,
  firmarSesion, leerAuth, leerCookie, sesionValida, type ConfigAuth,
} from "./auth-sesion";

const HASH = "scrypt:32768:8:1:c2FsdHNhbHRzYWx0c2FsdA==:aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g=";
const activo = (extra: Partial<Extract<ConfigAuth, { modo: "activo" }>> = {}) =>
  ({ modo: "activo", usuario: "admin", horas: 12, material: HASH, enClaro: false, ...extra }) as Extract<ConfigAuth, { modo: "activo" }>;
const AHORA = Date.parse("2026-11-03T12:00:00Z");

describe("leerAuth", () => {
  it("con el hash configurado queda activo (usuario por defecto 'admin', sesión de 12 h)", () => {
    expect(leerAuth({ AUTH_CLAVE_HASH: HASH })).toEqual({ modo: "activo", usuario: "admin", horas: 12, material: HASH, enClaro: false });
    expect(leerAuth({ AUTH_CLAVE_HASH: HASH, AUTH_USUARIO: " joaquin ", AUTH_HORAS: "2" })).toMatchObject({ usuario: "joaquin", horas: 2 });
  });
  it("sin clave NO queda abierto: falla cerrado, con el motivo", () => {
    for (const env of [{}, { AUTH_USUARIO: "x" }, { AUTH_CLAVE: "" }, { AUTH: "on" }, { AUTH: "" }, { AUTH: "quizás" }]) {
      const c = leerAuth(env);
      expect(c.modo, JSON.stringify(env)).toBe("sin_configurar");
      expect((c as { motivo: string }).motivo).toMatch(/clave/i);
    }
  });
  it("solo un AUTH=off explícito deja la app sin clave", () => {
    for (const v of ["off", "OFF", "0", "false", "no"]) expect(leerAuth({ AUTH: v }).modo).toBe("off");
  });
  it("una clave en claro se acepta (desaconsejada) pero tiene que tener al menos 10 caracteres", () => {
    expect(leerAuth({ AUTH_CLAVE: "una-clave-larga" })).toMatchObject({ modo: "activo", enClaro: true });
    expect(leerAuth({ AUTH_CLAVE: "corta" }).modo).toBe("sin_configurar");
  });
  it("si hay hash y clave en claro, manda el hash", () => {
    expect(leerAuth({ AUTH_CLAVE_HASH: HASH, AUTH_CLAVE: "otra-clave-larga" })).toMatchObject({ enClaro: false, material: HASH });
  });
  it("un hash con formato roto o una duración inválida dejan la app cerrada (no entra cualquiera)", () => {
    for (const h of ["basura", "scrypt:1:2", "bcrypt:1:2:3:a:b", "scrypt:a:b:c:d:e", "scrypt$32768$8$1$c2FsdA==$aGFzaA=="]) expect(leerAuth({ AUTH_CLAVE_HASH: h }).modo, h).toBe("sin_configurar");
    for (const horas of ["0", "-3", "abc", "9999", "NaN"]) expect(leerAuth({ AUTH_CLAVE_HASH: HASH, AUTH_HORAS: horas }).modo, horas).toBe("sin_configurar");
  });
});

describe("sesión firmada", () => {
  it("una sesión recién firmada es válida", async () => {
    const c = activo();
    expect(await sesionValida(c, await firmarSesion(c, AHORA), AHORA + 1000)).toBe(true);
  });
  it("vence exactamente a las `horas` configuradas", async () => {
    const c = activo({ horas: 2 });
    const s = await firmarSesion(c, AHORA);
    expect(await sesionValida(c, s, AHORA + 2 * 3_600_000 - 1)).toBe(true);
    expect(await sesionValida(c, s, AHORA + 2 * 3_600_000)).toBe(false);
  });
  it("no sirve si cambió el usuario o la clave: cambiar la clave cierra todas las sesiones", async () => {
    const s = await firmarSesion(activo(), AHORA);
    expect(await sesionValida(activo({ usuario: "otro" }), s, AHORA)).toBe(false);
    expect(await sesionValida(activo({ material: HASH + "x" }), s, AHORA)).toBe(false);
  });
  it("una cookie adulterada se rechaza (cuerpo o firma)", async () => {
    const c = activo();
    const [cuerpo, firma] = (await firmarSesion(c, AHORA)).split(".") as [string, string];
    const otro = btoa(JSON.stringify({ v: 1, u: "admin", e: AHORA + 10 ** 12 })).replace(/=+$/, "");
    expect(await sesionValida(c, `${otro}.${firma}`, AHORA)).toBe(false);                                     // alargué el vencimiento
    expect(await sesionValida(c, `${cuerpo}.${firma.slice(0, -2)}AA`, AHORA)).toBe(false);                     // firma tocada
    expect(await sesionValida(c, `${cuerpo}.${"A".repeat(firma.length)}`, AHORA)).toBe(false);
  });
  it.each(["", "x", "a.b.c", "....", ".", "a.", ".b", "%%%.%%%", "e30.e30", "a".repeat(2000)])("basura %j → no es sesión", async (cookie) => {
    expect(await sesionValida(activo(), cookie, AHORA)).toBe(false);
  });
  it("sin cookie, no hay sesión; con AUTH=off siempre hay; sin configurar nunca", async () => {
    expect(await sesionValida(activo(), undefined, AHORA)).toBe(false);
    expect(await sesionValida({ modo: "off" }, undefined, AHORA)).toBe(true);
    expect(await sesionValida({ modo: "sin_configurar", motivo: "x" }, await firmarSesion(activo(), AHORA), AHORA)).toBe(false);
  });
  it("dos firmas del mismo instante son iguales y dependen de la clave (determinista, sin secreto aparte)", async () => {
    expect(await firmarSesion(activo(), AHORA)).toBe(await firmarSesion(activo(), AHORA));
    expect(await firmarSesion(activo(), AHORA)).not.toBe(await firmarSesion(activo({ material: HASH + "y" }), AHORA));
  });
});

describe("cookie", () => {
  it("HttpOnly y SameSite=Strict siempre; Secure solo con HTTPS (en una red local por HTTP, Secure impediría entrar)", () => {
    const http = cookieDeSesion("v", 12, false);
    expect(http).toContain(`${COOKIE_SESION}=v`);
    expect(http).toMatch(/HttpOnly/); expect(http).toMatch(/SameSite=Strict/); expect(http).toMatch(/Path=\//); expect(http).toMatch(/Max-Age=43200/);
    expect(http).not.toMatch(/Secure/);
    expect(cookieDeSesion("v", 12, true)).toMatch(/; Secure$/);
    expect(cookieBorrada(false)).toMatch(/Max-Age=0/);
  });
  it("esHttps mira el protocolo y el encabezado de un proxy", () => {
    const h = (v?: string) => ({ get: (n: string) => (n === "x-forwarded-proto" ? v ?? null : null) });
    expect(esHttps({ url: "http://10.0.0.39:3100/x", headers: h() })).toBe(false);
    expect(esHttps({ url: "https://x/y", headers: h() })).toBe(true);
    expect(esHttps({ url: "http://x/y", headers: h("https, http") })).toBe(true);
    expect(esHttps({ url: "http://x/y", headers: h("http") })).toBe(false);
  });
  it("leerCookie encuentra el valor entre varias", () => {
    expect(leerCookie("a=1; agentcore_sesion=abc.def; linea=internet", COOKIE_SESION)).toBe("abc.def");
    expect(leerCookie("xagentcore_sesion=1", COOKIE_SESION)).toBeUndefined();
    expect(leerCookie(null, COOKIE_SESION)).toBeUndefined();
  });
});

describe("destinoSeguro (sin redirecciones abiertas)", () => {
  it.each([
    ["/", "/"], ["/consola", "/consola"], ["/bandeja?x=1", "/bandeja?x=1"], ["/agentes/cobros", "/agentes/cobros"],
    [null, "/"], [undefined, "/"], ["", "/"],
    ["//evil.com", "/"], ["/\\evil.com", "/"], ["https://evil.com", "/"], ["http://evil.com/x", "/"], ["javascript:alert(1)", "/"],
    ["evil.com", "/"], ["/%0d%0aSet-Cookie:x", "/%0d%0aSet-Cookie:x"], ["/a\nb", "/"], ["/\u0000", "/"],
    ["/login", "/"], ["/login?next=/x", "/"], ["/api/auth/login", "/"], ["/" + "a".repeat(600), "/"],
  ])("%j → %j", (entrada, esperado) => {
    expect(destinoSeguro(entrada as string | null | undefined)).toBe(esperado);
  });
});

describe("decidirAcceso", () => {
  const ped = (path: string, cookie?: string, search = "") => ({ path, search, cookie, ahora: AHORA });
  it("rutas públicas: solo el ingreso y su API", () => {
    for (const p of ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/estado"]) expect(esRutaPublica(p), p).toBe(true);
    for (const p of ["/", "/consola", "/api/agents", "/api/auth", "/api/auth/otra", "/login/x", "/api/agents/cobros/foto"]) expect(esRutaPublica(p), p).toBe(false);
  });
  it("sin sesión: las páginas van a /login (recordando adónde iban) y la API responde 401", async () => {
    const c = activo();
    expect(await decidirAcceso(c, ped("/consola"))).toEqual({ tipo: "login", destino: "/consola" });
    expect(await decidirAcceso(c, ped("/bandeja", undefined, "?filtro=critica"))).toEqual({ tipo: "login", destino: "/bandeja?filtro=critica" });
    expect(await decidirAcceso(c, ped("/api/agents"))).toEqual({ tipo: "no_autorizado" });
    expect(await decidirAcceso(c, ped("/api/agents/cobros/foto"))).toEqual({ tipo: "no_autorizado" });
    expect(await decidirAcceso(c, ped("/api/run"))).toEqual({ tipo: "no_autorizado" });
  });
  it("con una sesión válida pasa todo; con una inválida, no", async () => {
    const c = activo();
    const s = await firmarSesion(c, AHORA);
    for (const p of ["/", "/consola", "/api/agents", "/api/run"]) expect(await decidirAcceso(c, ped(p, s))).toEqual({ tipo: "pasa" });
    expect((await decidirAcceso(c, ped("/consola", "basura"))).tipo).toBe("login");
  });
  it("el ingreso se sirve sin sesión", async () => {
    expect(await decidirAcceso(activo(), ped("/login"))).toEqual({ tipo: "pasa" });
    expect(await decidirAcceso(activo(), ped("/api/auth/login"))).toEqual({ tipo: "pasa" });
  });
  it("un destino malicioso en la ruta no produce una redirección abierta", async () => {
    expect(await decidirAcceso(activo(), ped("//evil.com/x"))).toEqual({ tipo: "login", destino: "/" });
  });
  it("sin configurar: falla cerrado, también las rutas públicas (no hay con qué entrar)", async () => {
    const c: ConfigAuth = { modo: "sin_configurar", motivo: "falta la clave" };
    expect(await decidirAcceso(c, ped("/"))).toEqual({ tipo: "sin_configurar", motivo: "falta la clave", api: false });
    expect(await decidirAcceso(c, ped("/api/agents"))).toEqual({ tipo: "sin_configurar", motivo: "falta la clave", api: true });
    expect((await decidirAcceso(c, ped("/login"))).tipo).toBe("sin_configurar");
  });
  it("AUTH=off: todo pasa", async () => {
    expect(await decidirAcceso({ modo: "off" }, ped("/api/agents"))).toEqual({ tipo: "pasa" });
  });
});
