import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { leerAuth } from "./auth-sesion";
import { hashearClave } from "../../scripts/auth-hash.mjs";
import { mismoUsuario, verificarClave } from "./auth-clave";

const hash = hashearClave as (c: string) => string;

describe("verificarClave con hash scrypt", () => {
  const CLAVE = "una frase larga y mía";
  const H = hash(CLAVE);
  it("el hash que genera el script lo verifica el servidor (mismo formato, mismos parámetros)", () => {
    expect(H).toMatch(/^scrypt:32768:8:1:/);
    expect(H).not.toContain("$"); // un $ en el .env lo expande Next y el hash llegaría roto
    expect(verificarClave(CLAVE, H, false)).toBe(true);
  });
  it("una clave distinta, vacía, con un carácter de más o de menos o con otra capitalización, no entra", () => {
    for (const mala of ["", "otra", CLAVE + "x", CLAVE.slice(0, -1), CLAVE.toUpperCase(), ` ${CLAVE}`]) expect(verificarClave(mala, H, false), mala).toBe(false);
  });
  it("dos hashes de la misma clave son distintos (sal aleatoria) y los dos sirven", () => {
    const H2 = hash(CLAVE);
    expect(H2).not.toBe(H);
    expect(verificarClave(CLAVE, H2, false)).toBe(true);
  });
  it("el script se niega a hashear una clave corta", () => {
    expect(() => hash("corta")).toThrow(/al menos 10/);
  });
  it("un hash roto o adulterado da false, nunca lanza ni se cuelga", () => {
    const [alg, n, r, p, sal, h] = H.split(":") as [string, string, string, string, string, string];
    for (const malo of [
      "", "basura", "scrypt:1:2:3:4", `bcrypt:${n}:${r}:${p}:${sal}:${h}`,
      `scrypt:${2 ** 30}:8:1:${sal}:${h}`,                 // pide memoria enorme → se rechaza antes de calcular
      `scrypt:32768:8:1:${sal}:`, `scrypt:0:8:1:${sal}:${h}`, `scrypt:32768:0:1:${sal}:${h}`, `scrypt:32768:8:99:${sal}:${h}`,
      `scrypt:32768:8:1:${sal}:AAAA`,                      // hash demasiado corto
      `${alg}:abc:${r}:${p}:${sal}:${h}`,
    ]) expect(verificarClave(CLAVE, malo, false), malo).toBe(false);
  });
  it("una clave de más de 1024 caracteres se rechaza sin hashearla", () => {
    expect(verificarClave("a".repeat(1025), H, false)).toBe(false);
  });
});

describe("verificarClave en claro y usuario", () => {
  it("compara la clave en claro", () => {
    expect(verificarClave("clave-larga-123", "clave-larga-123", true)).toBe(true);
    expect(verificarClave("clave-larga-124", "clave-larga-123", true)).toBe(false);
    expect(verificarClave("", "clave-larga-123", true)).toBe(false);
  });
  it("mismoUsuario", () => {
    expect(mismoUsuario("admin", "admin")).toBe(true);
    expect(mismoUsuario("Admin", "admin")).toBe(false);
    expect(mismoUsuario("", "admin")).toBe(false);
  });
});

describe("el hash sobrevive al archivo .env (regresión: Next expande los `$`)", () => {
  it("lo que genera el script, escrito en un .env y leído con el cargador REAL de Next, llega entero y permite entrar", () => {
    const CLAVE = "otra frase larga para el .env";
    const h = hash(CLAVE);
    const dir = mkdtempSync(join(tmpdir(), "agentcore-env-"));
    const previo = { ...process.env };
    try {
      writeFileSync(join(dir, ".env"), `AUTH_CLAVE_HASH=${h}\nAUTH_USUARIO=joaquin\n`);
      delete process.env.AUTH_CLAVE_HASH;
      loadEnvConfig(dir, false, { info: () => undefined, error: () => undefined });
      expect(process.env.AUTH_CLAVE_HASH).toBe(h);                 // con `$` como separador esto llegaba cortado ("scrypt")
      const cfg = leerAuth(process.env);
      expect(cfg.modo).toBe("activo");
      if (cfg.modo === "activo") expect(verificarClave(CLAVE, cfg.material, false)).toBe(true);
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in previo)) delete process.env[k];
      Object.assign(process.env, previo);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
