import { describe, it, expect } from "vitest";
import type { AgentContext, Oportunidad, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteSeguimiento } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T00:00:00.000Z") };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteSeguimiento.run", () => {
  it("empuja la oportunidad vencida e ignora la cómoda", async () => {
    const items: Oportunidad[] = [
      { id: "op1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", contactoId: "c1", etapa: "propuesta", titulo: "Presupuesto", valorEstimado: 300000, cierreEstimado: "2026-08-10T00:00:00.000Z" },
      { id: "op2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", contactoId: "c2", etapa: "negociacion", titulo: "Ampliación", cierreEstimado: "2026-12-01T00:00:00.000Z" },
    ];
    const providers: ProviderRegistry = {
      pipeline: {
        async open() { return { items }; },
        async byContact() { return { items: [] }; },
      },
    };
    const out = await agenteSeguimiento.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    const r = out.recomendaciones[0]!;
    expect(r.tipo).toBe("seguimiento");
    expect(r.refEntidad).toEqual({ tipo: "oportunidad", id: "op1" });
    expect(r.impactoEstimado).toBe(300000);
  });

  it("sin pipeline → vacío", async () => {
    expect((await agenteSeguimiento.run(contexto({}))).recomendaciones).toHaveLength(0);
  });
});
