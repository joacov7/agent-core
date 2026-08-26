import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agentePrecios } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

const providers: ProviderRegistry = {
  competition: {
    async marketEvidence() {
      return { items: [
        { id: "m1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", fuente: "scraper", refEntidad: { tipo: "catalogo_item", id: "p1" }, precio: 900, observadoEn: "2026-08-01T00:00:00.000Z" },
      ] };
    },
  },
  catalog: {
    async items() {
      return { items: [
        { id: "p1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", nombre: "Mate", precio: 1200, costo: 600 },
      ] };
    },
    async get() { return null; },
  },
};

describe("agentePrecios.run", () => {
  it("sugiere bajar al mercado con la acción aplicar_precio", async () => {
    const out = await agentePrecios.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    const r = out.recomendaciones[0]!;
    expect(r.tipo).toBe("ajuste_precio");
    expect(r.accionTool).toBe("aplicar_precio");
    expect(r.accionesSugeridas?.[0]?.params).toMatchObject({ catalogoItemId: "p1", precio: 900 });
  });

  it("sin competition/catalog → vacío", async () => {
    expect((await agentePrecios.run(contexto({}))).recomendaciones).toHaveLength(0);
  });
});
