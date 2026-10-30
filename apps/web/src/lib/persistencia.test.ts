import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crearCoreStore } from "@agent-core/app-ejemplo";
import type { Recomendacion, TenantCtx } from "@agent-core/contracts";
import { persistirStore, rutaDeStore } from "./persistencia";

const ctxA: TenantCtx = { tenantId: "guaynet", now: () => new Date("2026-10-30T12:00:00Z") };
const ctxB: TenantCtx = { tenantId: "guaynet-seguridad", now: () => new Date("2026-10-30T12:00:00Z") };
const AHORA = () => new Date("2026-10-30T12:00:00Z");

function reco(tenantId: string, id: string, estado: Recomendacion["estado"], fecha: string): Recomendacion {
  return {
    id, tenantId, agentId: "cobros", estado, creadoEn: fecha, actualizadoEn: fecha,
    tipo: "cobro", severidad: "importante", titulo: `Reco ${id}`, descripcion: "x",
  } as unknown as Recomendacion;
}

let dir: string;
let ruta: string;
const log: string[] = [];
const opciones = () => ({ ruta, retardoMs: 5, ahora: AHORA, log: (m: string) => log.push(m) });

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "agentcore-store-")); ruta = join(dir, "sub", "store.json"); log.length = 0; });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("persistirStore", () => {
  it("lo que se escribe sobrevive a un 'reinicio' (otro store que carga el archivo), separado por tenant", async () => {
    const s1 = crearCoreStore();
    const p1 = persistirStore(s1, opciones());
    await s1.agentConfig.set(ctxA, { agentId: "cobros", encendido: true, autonomia: "assisted", alias: "Cobi" });
    await s1.agentConfig.set(ctxB, { agentId: "guardia", encendido: true, autonomia: "assisted" });
    await s1.recommendations.save(ctxA, reco("guaynet", "r1", "proposed", "2026-10-29T00:00:00Z"));
    await s1.memory.put(ctxA, { id: "m1", tenantId: "guaynet", creadoEn: "2026-10-29T00:00:00Z", namespace: "rechazos", clave: "k", contenido: { a: 1 } } as never);
    await s1.gastoIA.registrar(ctxA, { id: "g1", tenantId: "guaynet", creadoEn: "2026-10-29T00:00:00Z", model: "m", inputTokens: 1, outputTokens: 1, costo: 0.5 });
    await p1.guardar();

    const s2 = crearCoreStore();
    const p2 = persistirStore(s2, opciones());
    expect(p2.cargadas).toEqual({ recomendaciones: 1, agentes: 2, descartadas: 0 });
    expect((await s2.agentConfig.get(ctxA, "cobros"))?.alias).toBe("Cobi");
    expect((await s2.agentConfig.list(ctxB)).map((c) => c.agentId)).toEqual(["guardia"]);
    expect((await s2.agentConfig.get(ctxB, "cobros"))).toBeNull(); // el aislamiento por tenant se mantiene
    expect((await s2.recommendations.list(ctxA)).items.map((r) => r.id)).toEqual(["r1"]);
    expect((await s2.recommendations.list(ctxB)).items).toHaveLength(0);
    expect((await s2.memory.get(ctxA, "rechazos", "k"))?.contenido).toEqual({ a: 1 });
    expect(await s2.gastoIA.totalPorTenant(ctxA)).toBe(0.5); // el presupuesto de IA no se "resetea" reiniciando
  });

  it("guarda solo después del retardo y junta ráfagas en una escritura", async () => {
    const s = crearCoreStore();
    persistirStore(s, { ...opciones(), retardoMs: 30 });
    await s.recommendations.save(ctxA, reco("guaynet", "r1", "proposed", "2026-10-29T00:00:00Z"));
    await s.recommendations.save(ctxA, reco("guaynet", "r2", "proposed", "2026-10-29T00:00:00Z"));
    expect(existsSync(ruta)).toBe(false);
    await new Promise((r) => setTimeout(r, 120));
    expect(JSON.parse(readFileSync(ruta, "utf8")).recos).toHaveLength(2);
  });

  it("el archivo queda con permisos 600 (la bandeja tiene datos de clientes) y no deja temporales", async () => {
    const s = crearCoreStore();
    const p = persistirStore(s, opciones());
    await s.recommendations.save(ctxA, reco("guaynet", "r1", "proposed", "2026-10-29T00:00:00Z"));
    await p.guardar();
    expect(statSync(ruta).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, "sub")).mode & 0o077).toBe(0); // la carpeta, creada por nosotros, no es legible por otros
    const sobras = readdirSync(join(dir, "sub")).filter((f) => f.endsWith(".tmp"));
    expect(sobras).toEqual([]);
  });

  it("poda las recomendaciones terminales viejas, pero conserva las vivas aunque sean viejas", async () => {
    const s1 = crearCoreStore();
    const p1 = persistirStore(s1, opciones());
    await s1.recommendations.save(ctxA, reco("guaynet", "vieja-ejecutada", "executed", "2026-05-01T00:00:00Z"));
    await s1.recommendations.save(ctxA, reco("guaynet", "vieja-viva", "proposed", "2026-05-01T00:00:00Z"));
    await s1.recommendations.save(ctxA, reco("guaynet", "reciente-rechazada", "rejected", "2026-10-20T00:00:00Z"));
    await p1.guardar();

    const s2 = crearCoreStore();
    const p2 = persistirStore(s2, opciones());
    expect(p2.cargadas.descartadas).toBe(1);
    expect((await s2.recommendations.list(ctxA)).items.map((r) => r.id).sort()).toEqual(["reciente-rechazada", "vieja-viva"]);
    await new Promise((r) => setTimeout(r, 60));
    expect(JSON.parse(readFileSync(ruta, "utf8")).recos).toHaveLength(2); // la poda quedó en disco
  });

  it("un archivo dañado o de otro formato no tumba el arranque: store vacío y aviso", () => {
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(ruta, "{ esto no es json");
    const s = crearCoreStore();
    const p = persistirStore(s, opciones());
    expect(p.cargadas).toEqual({ recomendaciones: 0, agentes: 0, descartadas: 0 });
    expect(log.join("\n")).toMatch(/dañado/);

    writeFileSync(ruta, JSON.stringify({ version: 99, recos: [] }));
    persistirStore(crearCoreStore(), opciones());
    expect(log.join("\n")).toMatch(/formato desconocido/);
  });

  it("filtra filas sin forma de fila (editadas a mano o a medias): no entran al store", async () => {
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(ruta, JSON.stringify({
      version: 1,
      recos: [reco("guaynet", "ok", "proposed", "2026-10-29T00:00:00Z"), { id: "sin-tenant" }, null, "texto", { tenantId: "guaynet" }],
      results: "no es array", impacts: [], mem: [], gasto: [],
      agentCfgs: [{ tenantId: "guaynet", agentId: "cobros", encendido: true, autonomia: "assisted" }, { tenantId: "guaynet" }],
    }));
    const s = crearCoreStore();
    const p = persistirStore(s, opciones());
    expect(p.cargadas).toEqual({ recomendaciones: 1, agentes: 1, descartadas: 0 });
  });

  it("un fallo al escribir no tumba la app, se avisa y se reintenta con el siguiente cambio", async () => {
    const s = crearCoreStore();
    // la ruta cuelga de un ARCHIVO, no de una carpeta: mkdir falla
    writeFileSync(join(dir, "archivo"), "x");
    const mala = join(dir, "archivo", "store.json");
    const p = persistirStore(s, { ...opciones(), ruta: mala });
    await expect(s.recommendations.save(ctxA, reco("guaynet", "r1", "proposed", "2026-10-29T00:00:00Z"))).resolves.toBeDefined();
    await p.guardar();
    expect(log.join("\n")).toMatch(/no pude guardar/);
  });
});

describe("rutaDeStore", () => {
  it("persistente por defecto, configurable y apagable", () => {
    expect(rutaDeStore({})).toBe(".agentcore/store.json");
    expect(rutaDeStore({ STORE_ARCHIVO: " /var/lib/agentcore/s.json " })).toBe("/var/lib/agentcore/s.json");
    for (const off of ["off", "0", "false", "no", "OFF"]) expect(rutaDeStore({ STORE_PERSISTENTE: off })).toBeUndefined();
    expect(rutaDeStore({ STORE_PERSISTENTE: "on" })).toBe(".agentcore/store.json");
  });
});
