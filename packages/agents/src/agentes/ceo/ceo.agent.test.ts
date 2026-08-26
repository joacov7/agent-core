import { describe, it, expect } from "vitest";
import type { AgentContext, CoreStore, Recomendacion, TenantCtx } from "@agent-core/contracts";
import { agenteCeo } from "./index.js";

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
    id: "r", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", agentId: "x", tipo: "t",
    titulo: "T", estado: "proposed", severidad: "importante", confianza: 80, prioridad: 2, ...over,
  };
}

describe("agenteCeo.run", () => {
  it("resume el estado a partir de las recomendaciones del store", async () => {
    const store = storeCon([reco({ severidad: "critica", prioridad: 1, titulo: "Cobrar X" })]);
    const context: AgentContext = { ctx, providers: {}, store, config: {} };
    const out = await agenteCeo.run(context);
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toContain("Estado:");
    expect(out.resumen).toContain("Cobrar X");
  });
});
