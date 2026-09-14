import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import { runSeleccion } from "@agent-core/core";
import { catalogo } from "@agent-core/agents";
import { crearApp } from "./app.js";

const ctx: TenantCtx = { tenantId: "demo", requestId: "req-sel", now: () => new Date("2026-08-25T12:00:00.000Z") };

describe("selección por tenant (persistencia de qué agentes corren)", () => {
  it("por defecto apagado: corre SOLO los agentes encendidos en la config", async () => {
    const app = crearApp();
    await app.store.agentConfig.set(ctx, { agentId: "crm", encendido: true, autonomia: "manual" });
    await app.store.agentConfig.set(ctx, { agentId: "cobros", encendido: true, autonomia: "autonomous", plan: "Pro" });

    const res = await runSeleccion({
      catalogo, ctx, providers: app.providers, store: app.store, modeloNegocio: app.modeloNegocio,
    });

    expect(res.ejecutados.map((e) => e.agentId).sort()).toEqual(["cobros", "crm"]);
    const cobros = res.ejecutados.find((e) => e.agentId === "cobros")!;
    expect(cobros.autonomia).toBe("assisted"); // pidió autonomous, pero cobros topea en assisted
    expect(cobros.plan).toBe("Pro");
    expect(res.recomendaciones.length).toBeGreaterThan(0); // corrió y persistió
  });

  it("por defecto encendido: corre los activables salvo los apagados explícitamente", async () => {
    const app = crearApp();
    await app.store.agentConfig.set(ctx, { agentId: "precios", encendido: false, autonomia: "manual" });

    const res = await runSeleccion({
      catalogo, ctx, providers: app.providers, store: app.store,
      modeloNegocio: app.modeloNegocio, pordefecto: "encendido",
    });
    const ids = res.ejecutados.map((e) => e.agentId);
    expect(ids).toContain("crm");            // activable + default encendido
    expect(ids).not.toContain("precios");    // apagado explícito
    expect(ids).not.toContain("compliance"); // no activable (retail no expone documents)
  });

  it("la selección es por tenant: otro tenant no hereda la config de demo", async () => {
    const app = crearApp();
    await app.store.agentConfig.set(ctx, { agentId: "crm", encendido: true, autonomia: "manual" });

    const otro: TenantCtx = { tenantId: "otro" };
    expect(await app.store.agentConfig.list(otro)).toHaveLength(0);

    const res = await runSeleccion({
      catalogo, ctx: otro, providers: app.providers, store: app.store, modeloNegocio: app.modeloNegocio,
    });
    expect(res.ejecutados).toHaveLength(0); // sin config propia y default apagado
  });
});
