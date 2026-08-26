import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteMorosidad } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T00:00:00.000Z") };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteMorosidad.run", () => {
  it("clasifica el nivel de mora de un cobro vencido", async () => {
    const providers: ProviderRegistry = {
      receivables: {
        async pending() { return { items: [] }; },
        async overdue() {
          return { items: [
            { id: "cob1", tenantId: "t1", creadoEn: "2026-01-01T00:00:00.000Z", contactoId: "c1", estado: "vencido", monto: 90000, venceEn: "2026-07-16T00:00:00.000Z" }, // ~40d
          ] };
        },
      },
    };
    const out = await agenteMorosidad.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    expect(out.recomendaciones[0]!.tipo).toBe("mora_media");
    expect(out.recomendaciones[0]!.impactoEstimado).toBe(90000);
  });

  it("sin receivables → vacío", async () => {
    expect((await agenteMorosidad.run(contexto({}))).recomendaciones).toHaveLength(0);
  });
});
