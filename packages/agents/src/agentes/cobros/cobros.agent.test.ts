import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteCobros } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T00:00:00.000Z") };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteCobros.run", () => {
  it("sin receivables → vacío", async () => {
    const out = await agenteCobros.run(contexto({}));
    expect(out.recomendaciones).toHaveLength(0);
  });

  it("prioriza un cobro vencido", async () => {
    const providers: ProviderRegistry = {
      receivables: {
        async pending() { return { items: [] }; },
        async overdue() {
          return { items: [
            { id: "cob1", tenantId: "t1", creadoEn: "2026-01-01T00:00:00.000Z", contactoId: "c1", estado: "vencido", monto: 150000, moneda: "ARS", venceEn: "2026-07-01T00:00:00.000Z" },
          ] };
        },
      },
    };
    const out = await agenteCobros.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    const r = out.recomendaciones[0]!;
    expect(r.tipo).toBe("cobro_vencido");
    expect(r.severidad).toBe("critica"); // >30 días
    expect(r.impactoEstimado).toBe(150000);
    expect(r.refEntidad).toEqual({ tipo: "cobro", id: "cob1" });
  });
});
