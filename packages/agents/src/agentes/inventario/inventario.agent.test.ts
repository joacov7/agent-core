import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteInventario } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteInventario.run", () => {
  it("alerta quiebre y reposición", async () => {
    const providers: ProviderRegistry = {
      inventory: {
        async stock() { return { items: [] }; },
        async lowStock() {
          return { items: [
            { id: "ex1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", catalogoItemId: "p1", cantidad: 0, minimo: 5 },
            { id: "ex2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", catalogoItemId: "p2", cantidad: 3, minimo: 5 },
          ] };
        },
      },
    };
    const out = await agenteInventario.run(contexto(providers));
    const tipos = out.recomendaciones.map((r) => r.tipo);
    expect(tipos).toContain("quiebre");
    expect(tipos).toContain("reponer");
  });

  it("sin inventory → vacío", async () => {
    const out = await agenteInventario.run(contexto({}));
    expect(out.recomendaciones).toHaveLength(0);
  });
});
