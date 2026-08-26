import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteCompras } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteCompras.run", () => {
  it("sugiere reposición para los ítems bajo el mínimo", async () => {
    const providers: ProviderRegistry = {
      inventory: {
        async stock() { return { items: [] }; },
        async lowStock() {
          return { items: [
            { id: "ex1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", catalogoItemId: "p1", cantidad: 2, minimo: 5 },
          ] };
        },
      },
      suppliers: {
        async list() { return { items: [{ id: "prov1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", nombre: "Prov", roles: ["proveedor"] }] }; },
        async purchases() { return { items: [] }; },
      },
    };
    const out = await agenteCompras.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    expect(out.recomendaciones[0]!.tipo).toBe("comprar");
    expect(out.recomendaciones[0]!.refEntidad).toEqual({ tipo: "catalogo_item", id: "p1" });
  });

  it("sin inventory/suppliers → vacío", async () => {
    expect((await agenteCompras.run(contexto({}))).recomendaciones).toHaveLength(0);
  });
});
