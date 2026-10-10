import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import { crearApp } from "@agent-core/app-ejemplo";
import { crearServicio } from "./service.js";

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
});
