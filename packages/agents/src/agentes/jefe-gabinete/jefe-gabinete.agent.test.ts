import { describe, it, expect } from "vitest";
import type { AgentContext, CoreStore, Recomendacion, TenantCtx } from "@agent-core/contracts";
import { agenteJefeGabinete } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };

function storeCon(recos: Recomendacion[]): CoreStore {
  return {
    recommendations: { async save(_c, r) { return r; }, async get() { return null; }, async list() { return { items: recos }; } },
    actionResults: { async save(_c, r) { return r; }, async list() { return { items: [] }; } },
    impacts: { async save(_c, i) { return i; }, async list() { return { items: [] }; }, async byRecomendacion() { return []; } },
    memory: { async put(_c, e) { return e; }, async get() { return null; }, async list() { return { items: [] }; } },
  };
}

function reco(over: Partial<Recomendacion>): Recomendacion {
  return {
    id: "r", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", agentId: "cobros", tipo: "cobro_vencido",
    titulo: "T", estado: "proposed", severidad: "critica", confianza: 95, prioridad: 1, ...over,
  };
}

describe("agenteJefeGabinete.run", () => {
  it("prioriza y resume las recomendaciones del store", async () => {
    const store = storeCon([
      reco({ id: "a", titulo: "Cobrar A", prioridad: 1 }),
      reco({ id: "b", titulo: "Reponer B", severidad: "importante", prioridad: 2, agentId: "inventario" }),
    ]);
    const context: AgentContext = { ctx, providers: {}, store, config: {} };
    const out = await agenteJefeGabinete.run(context);
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toContain("Prioridad 1");
    expect(out.resumen).toContain("Cobrar A");
  });

  it("sin recomendaciones → texto de 'todo en orden'", async () => {
    const context: AgentContext = { ctx, providers: {}, store: storeCon([]), config: {} };
    const out = await agenteJefeGabinete.run(context);
    expect(out.resumen).toMatch(/orden|Sin recomendaciones/i);
  });
});
