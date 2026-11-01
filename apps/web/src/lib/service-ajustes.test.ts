import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import { crearApp } from "@agent-core/app-ejemplo";
import { crearServicio, ErrorDeValidacion } from "./service.js";

const ctx: TenantCtx = { tenantId: "demo", now: () => new Date("2026-08-25T12:00:00.000Z") };
const demo = (extra: { config?: Record<string, unknown>; fotosDe?: (c: TenantCtx) => Record<string, string> } = {}) => {
  const app = crearApp();
  return crearServicio({ store: app.store, providers: app.providers, modeloNegocio: app.modeloNegocio, ...extra });
};
const ajustesDe = async (s: ReturnType<typeof demo>, id: string) => (await s.listarAgentes(ctx)).find((v) => v.manifest.id === id)!.ajustes;

describe("ajustes por agente (servicio)", () => {
  it("los agentes configurables exponen sus campos y valores; los demás no", async () => {
    const s = demo();
    const cobros = await ajustesDe(s, "cobros");
    expect(cobros!.campos.map((c) => c.clave)).toEqual(["diasCritico", "montoRelevante"]);
    expect(cobros!.valores).toEqual({ diasCritico: 30, montoRelevante: 0 });
    expect(cobros!.personalizados).toEqual([]);
    expect(await ajustesDe(s, "tareas")).toBeUndefined();
  });

  it("guardar ajustes válidos los refleja, marca qué es propio y cambia lo que el agente encuentra", async () => {
    const s = demo();
    await s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "manual" });
    await s.correr(ctx);
    const antes = (await s.listarRecomendaciones(ctx)).filter((r) => r.agentId === "cobros").length;
    expect(antes).toBeGreaterThan(0);

    await s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "manual", config: { montoRelevante: 1_000_000_000 } });
    const a = (await ajustesDe(s, "cobros"))!;
    expect(a.valores).toEqual({ diasCritico: 30, montoRelevante: 1_000_000_000 });
    expect(a.personalizados).toEqual(["montoRelevante"]);

    await s.correr(ctx);
    expect((await s.listarRecomendaciones(ctx)).filter((r) => r.agentId === "cobros")).toHaveLength(0); // ya no alcanza el monto
  });

  it("los ajustes inválidos se rechazan con un mensaje claro y NO se guardan", async () => {
    const s = demo();
    const malo = (config: unknown, agentId = "cobros") =>
      s.setAgente(ctx, { agentId, encendido: true, autonomia: "manual", config: config as never }).catch((e) => e);
    for (const [cfg, id] of [
      [{ diasCritico: 0 }, "cobros"], [{ diasCritico: 30.5 }, "cobros"], [{ diasCritico: "30" }, "cobros"],
      [{ diasCritico: 9999 }, "cobros"], [{ nope: 1 }, "cobros"], [[], "cobros"], [null, "cobros"], [{ x: 1 }, "tareas"],
    ] as [unknown, string][]) {
      expect(await malo(cfg, id), JSON.stringify(cfg)).toBeInstanceOf(ErrorDeValidacion);
    }
    expect(((await malo({ diasCritico: 0 })) as Error).message).toMatch(/"Cobro crítico" no puede ser menor que 1/);
    expect((await ajustesDe(s, "cobros"))!.personalizados).toEqual([]);
    expect((await s.listarAgentes(ctx)).find((v) => v.manifest.id === "cobros")!.encendido).toBe(false); // ni siquiera se encendió
  });

  it("un agente que no existe se rechaza (antes se guardaba basura)", async () => {
    const s = demo();
    expect(await s.setAgente(ctx, { agentId: "direccion", encendido: true, autonomia: "manual" }).catch((e) => e)).toBeInstanceOf(ErrorDeValidacion);
  });

  it("prender/apagar sin mandar ajustes ni nombre NO los pisa; {} restaura los ajustes", async () => {
    const s = demo();
    await s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "manual", alias: "Cobi", config: { diasCritico: 45 } });
    await s.setAgente(ctx, { agentId: "cobros", encendido: false, autonomia: "manual" });   // lo apaga, como hace la consola
    const apagado = (await s.listarAgentes(ctx)).find((v) => v.manifest.id === "cobros")!;
    expect(apagado.persona.nombre).toBe("Cobi");
    expect(apagado.ajustes!.valores.diasCritico).toBe(45);

    await s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "manual", config: {} });   // restaurar
    const restaurado = (await ajustesDe(s, "cobros"))!;
    expect(restaurado.valores.diasCritico).toBe(30);
    expect(restaurado.personalizados).toEqual([]);
    expect((await s.listarAgentes(ctx)).find((v) => v.manifest.id === "cobros")!.persona.nombre).toBe("Cobi"); // el nombre sigue
  });

  describe("config base de la línea", () => {
    const base = { diasProximo: 15, diasAviso: 30 };

    it("la vista muestra la base como valor y como 'restaurar a'; lo propio la pisa solo en esa clave", async () => {
      const s = demo({ config: base });
      expect((await ajustesDe(s, "agenda"))!.valores).toEqual(base);
      await s.setAgente(ctx, { agentId: "agenda", encendido: true, autonomia: "manual", config: { diasAviso: 20 } });
      const a = (await ajustesDe(s, "agenda"))!;
      expect(a.valores).toEqual({ diasProximo: 15, diasAviso: 20 });
      expect(a.porDefecto).toEqual(base);
      expect(a.personalizados).toEqual(["diasAviso"]);
    });

    it("al correr, lo propio pisa SOLO su clave y el resto sigue siendo el de la línea (no vuelve al default del agente)", async () => {
      const ahora = new Date("2026-10-30T15:00:00Z");
      const c: TenantCtx = { tenantId: "t1", now: () => ahora };
      const evento = (id: string, inicia: string) => ({ id, tenantId: "t1", creadoEn: ahora.toISOString(), tipo: "vencimiento_contrato", titulo: id, inicia });
      const providers = { agenda: { upcoming: async () => ({ items: [evento("en-12-dias", "2026-11-11T02:59:59.000Z"), evento("en-25-dias", "2026-11-24T02:59:59.000Z")] }) } };
      const app = crearApp();
      const s = crearServicio({ store: app.store, providers, modeloNegocio: "suscripcion", config: base });
      // propio: solo diasProximo=20. diasAviso (30) tiene que seguir viniendo de la línea.
      await s.setAgente(c, { agentId: "agenda", encendido: true, autonomia: "manual", config: { diasProximo: 20 } });
      await s.correr(c);
      const sev = Object.fromEntries((await s.listarRecomendaciones(c)).filter((r) => r.agentId === "agenda").map((r) => [r.refEntidad!.id, r.severidad]));
      expect(sev).toEqual({ "en-12-dias": "importante", "en-25-dias": "oportunidad" }); // con el default (7/2) no habría ni uno
    });
  });

  it("fotosDe: la foto del tenant llega a la persona; sin foto no hay fotoUrl", async () => {
    const s = demo({ fotosDe: () => ({ cobros: "/api/agents/cobros/foto?v=1" }) });
    const vistas = await s.listarAgentes(ctx);
    expect(vistas.find((v) => v.manifest.id === "cobros")!.persona.fotoUrl).toBe("/api/agents/cobros/foto?v=1");
    expect(vistas.find((v) => v.manifest.id === "crm")!.persona).not.toHaveProperty("fotoUrl");
    expect((await demo().listarAgentes(ctx))[0]!.persona).not.toHaveProperty("fotoUrl");
  });
});
