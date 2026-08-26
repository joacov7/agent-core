import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteAgenda } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T00:00:00.000Z") };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteAgenda.run", () => {
  it("marca el evento próximo/vencido e ignora el lejano", async () => {
    const providers: ProviderRegistry = {
      agenda: {
        async upcoming() {
          return { items: [
            { id: "ev1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "vencimiento", titulo: "AFIP", inicia: "2026-08-20T00:00:00.000Z" },
            { id: "ev2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "turno", titulo: "Reunión", inicia: "2026-11-01T00:00:00.000Z" },
          ] };
        },
      },
    };
    const out = await agenteAgenda.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    expect(out.recomendaciones[0]!.tipo).toBe("vencimiento");
    expect(out.recomendaciones[0]!.severidad).toBe("critica"); // ya vencido
    expect(out.recomendaciones[0]!.refEntidad).toEqual({ tipo: "evento", id: "ev1" });
  });

  it("sin agenda → vacío", async () => {
    const out = await agenteAgenda.run(contexto({}));
    expect(out.recomendaciones).toHaveLength(0);
  });
});
