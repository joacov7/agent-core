import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import { crearApp } from "@agent-core/app-ejemplo";
import { crearServicio, ErrorDeValidacion } from "./service.js";

// La capa de servicio sobre el adapter de referencia in-memory (retail). Valida que
// la API expone correctamente disponibilidad + config + corrida, sin HTTP ni Next.
const ctx: TenantCtx = { tenantId: "demo", now: () => new Date("2026-08-25T12:00:00.000Z") };

function servicioDemo() {
  const app = crearApp();
  return crearServicio({ store: app.store, providers: app.providers, modeloNegocio: app.modeloNegocio });
}

describe("Servicio del SaaS", () => {
  it("listarAgentes: marca disponibles y arranca todo apagado sin config", async () => {
    const s = servicioDemo();
    const vistas = await s.listarAgentes(ctx);
    expect(vistas).toHaveLength(28);
    const porId = new Map(vistas.map((v) => [v.manifest.id, v]));
    expect(porId.get("cobros")!.disponible).toBe(true);
    expect(porId.get("compliance")!.disponible).toBe(false); // retail no expone documents
    expect(vistas.every((v) => v.encendido === false)).toBe(true); // fail-closed
  });

  it("setAgente persiste y listarAgentes lo refleja", async () => {
    const s = servicioDemo();
    await s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "assisted", plan: "Pro" });
    const cobros = (await s.listarAgentes(ctx)).find((v) => v.manifest.id === "cobros")!;
    expect(cobros.encendido).toBe(true);
    expect(cobros.autonomia).toBe("assisted");
    expect(cobros.plan).toBe("Pro");
  });

  it("correr ejecuta solo los agentes encendidos y persiste recomendaciones", async () => {
    const s = servicioDemo();
    await s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "manual" });
    await s.setAgente(ctx, { agentId: "inventario", encendido: true, autonomia: "manual" });
    const res = await s.correr(ctx);
    expect(res.ejecutados.map((e) => e.agentId).sort()).toEqual(["cobros", "inventario"]);
    expect(res.recomendaciones.length).toBeGreaterThan(0);
  });

  it("listarRecomendaciones devuelve la bandeja ordenada por prioridad", async () => {
    const s = servicioDemo();
    expect(await s.listarRecomendaciones(ctx)).toHaveLength(0); // vacía antes de correr
    await s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "manual" });
    await s.correr(ctx);
    const bandeja = await s.listarRecomendaciones(ctx);
    expect(bandeja.length).toBeGreaterThan(0);
    for (let i = 1; i < bandeja.length; i++) {
      expect(bandeja[i - 1]!.prioridad).toBeLessThanOrEqual(bandeja[i]!.prioridad);
    }
  });

  it("persona: nombre por defecto, alias del tenant que sobrevive a otros cambios y se puede borrar", async () => {
    const s = servicioDemo();
    const vista = async () => (await s.listarAgentes(ctx)).find((v) => v.manifest.id === "cobros")!;
    expect((await vista()).persona).toMatchObject({ nombre: "Lou", rol: "Cobros", personalizado: false });

    await s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "manual", alias: "  Lucía  " });
    expect((await vista()).persona).toMatchObject({ nombre: "Lucía", personalizado: true });

    // Un PUT sin alias (como el de la consola al prender/apagar) no pisa el nombre.
    await s.setAgente(ctx, { agentId: "cobros", encendido: false, autonomia: "manual" });
    expect((await vista()).persona.nombre).toBe("Lucía");

    await s.setAgente(ctx, { agentId: "cobros", encendido: false, autonomia: "manual", alias: "" });
    expect((await vista()).persona).toMatchObject({ nombre: "Lou", personalizado: false });

    await expect(
      s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "manual", alias: "x".repeat(41) }),
    ).rejects.toBeInstanceOf(ErrorDeValidacion);
  });

  it("estado en vivo: no disponible → apagado → en espera → con novedades", async () => {
    const s = servicioDemo();
    const estado = async (id: string) => (await s.listarAgentes(ctx)).find((v) => v.manifest.id === id)!;
    expect((await estado("compliance")).estado).toBe("no_disponible");
    expect((await estado("cobros")).estado).toBe("apagado");

    await s.setAgente(ctx, { agentId: "cobros", encendido: true, autonomia: "manual" });
    expect(await estado("cobros")).toMatchObject({ estado: "en_espera", novedades: 0 });

    await s.correr(ctx);
    const tras = await estado("cobros");
    expect(tras.novedades).toBeGreaterThan(0);
    expect(["con_novedades", "esperando_aprobacion"]).toContain(tras.estado);

    // Apagarlo lo saca de la guardia aunque queden recomendaciones.
    await s.setAgente(ctx, { agentId: "cobros", encendido: false, autonomia: "manual" });
    expect((await estado("cobros")).estado).toBe("apagado");
  });
});
