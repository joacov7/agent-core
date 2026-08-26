import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteProduccion } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T00:00:00.000Z") };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteProduccion.run", () => {
  it("marca el proceso demorado e ignora el lejano", async () => {
    const providers: ProviderRegistry = {
      production: {
        async processes() {
          return { items: [
            { id: "proc1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "faena", titulo: "Lote A", estado: "en_progreso", venceEn: "2026-08-24T00:00:00.000Z" },
            { id: "proc2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "mantenimiento", titulo: "Service", estado: "pendiente", venceEn: "2026-09-15T00:00:00.000Z" },
          ] };
        },
      },
    };
    const out = await agenteProduccion.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    expect(out.recomendaciones[0]!.tipo).toBe("proceso");
    expect(out.recomendaciones[0]!.severidad).toBe("critica");
  });

  it("sin production → vacío", async () => {
    expect((await agenteProduccion.run(contexto({}))).recomendaciones).toHaveLength(0);
  });
});
