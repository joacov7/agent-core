import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteLogistica } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T00:00:00.000Z") };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteLogistica.run", () => {
  it("marca la entrega demorada e ignora la completada", async () => {
    const providers: ProviderRegistry = {
      logistics: {
        async deliveries() {
          return { items: [
            { id: "ent1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "entrega", titulo: "Pedido #1", estado: "pendiente", venceEn: "2026-08-22T00:00:00.000Z" },
            { id: "ent2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "entrega", titulo: "Pedido #2", estado: "completada", venceEn: "2026-08-20T00:00:00.000Z" },
          ] };
        },
      },
    };
    const out = await agenteLogistica.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    expect(out.recomendaciones[0]!.tipo).toBe("entrega");
    expect(out.recomendaciones[0]!.refEntidad).toEqual({ tipo: "tarea", id: "ent1" });
  });

  it("sin logistics → vacío", async () => {
    expect((await agenteLogistica.run(contexto({}))).recomendaciones).toHaveLength(0);
  });
});
