import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteCompetencia } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

const providers: ProviderRegistry = {
  competition: {
    async marketEvidence() {
      return { items: [
        { id: "m1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", fuente: "scraper", refEntidad: { tipo: "catalogo_item", id: "p1" }, precio: 900, observadoEn: "2026-08-01T00:00:00.000Z" },
        { id: "m2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", fuente: "scraper", refEntidad: { tipo: "catalogo_item", id: "p2" }, precio: 5100, observadoEn: "2026-08-01T00:00:00.000Z" },
      ] };
    },
  },
  catalog: {
    async items() {
      return { items: [
        { id: "p1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", nombre: "Mate", precio: 1200, costo: 600 },
        { id: "p2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", nombre: "Termo", precio: 5000, costo: 3000 },
      ] };
    },
    async get() { return null; },
  },
};

describe("agenteCompetencia.run", () => {
  it("marca al ítem caro vs mercado e ignora el que está en línea", async () => {
    const out = await agenteCompetencia.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    expect(out.recomendaciones[0]!.tipo).toBe("competencia_por_encima");
    expect(out.recomendaciones[0]!.refEntidad).toEqual({ tipo: "catalogo_item", id: "p1" });
  });

  it("sin competition/catalog → vacío", async () => {
    expect((await agenteCompetencia.run(contexto({}))).recomendaciones).toHaveLength(0);
  });
});
