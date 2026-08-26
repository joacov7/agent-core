import { describe, it, expect } from "vitest";
import type { AgentContext, Oportunidad, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteVentas } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteVentas.run", () => {
  it("prioriza oportunidades por valor esperado", async () => {
    const items: Oportunidad[] = [
      { id: "op1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", etapa: "negociacion", titulo: "Grande", valorEstimado: 100000, probabilidad: 0.8 },
      { id: "op2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", etapa: "propuesta", titulo: "Sin valor" },
    ];
    const providers: ProviderRegistry = {
      pipeline: { async open() { return { items }; }, async byContact() { return { items: [] }; } },
    };
    const out = await agenteVentas.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1); // op2 sin valor no emite
    const r = out.recomendaciones[0]!;
    expect(r.tipo).toBe("venta");
    expect(r.severidad).toBe("importante"); // prob 0.8
    expect(r.impactoEstimado).toBe(80000);
  });

  it("sin pipeline → vacío", async () => {
    expect((await agenteVentas.run(contexto({}))).recomendaciones).toHaveLength(0);
  });
});
