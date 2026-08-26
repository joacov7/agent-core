import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, ResumenContacto, TenantCtx } from "@agent-core/contracts";
import { agenteAnalista } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteAnalista.run", () => {
  it("reporta KPIs y marca el ticket atípico", async () => {
    const items: ResumenContacto[] = [
      { contactoId: "a", compras: 4, totalGastado: 400, ticketPromedio: 100, diasDesdeUltima: 10 },
      { contactoId: "b", compras: 6, totalGastado: 600, ticketPromedio: 100, diasDesdeUltima: 10 },
      { contactoId: "vip", compras: 1, totalGastado: 400, ticketPromedio: 400, diasDesdeUltima: 10 },
    ];
    const providers: ProviderRegistry = {
      transactions: {
        async byContact() { return { items: [] }; },
        async recent() { return { items: [] }; },
        async resumenPorContacto() { return { items }; },
      },
    };
    const out = await agenteAnalista.run(contexto(providers));
    expect(out.resumen).toContain("KPIs");
    const anom = out.recomendaciones.find((r) => r.refEntidad?.id === "vip");
    expect(anom?.tipo).toBe("anomalia");
  });

  it("sin resumenPorContacto → vacío con nota", async () => {
    const out = await agenteAnalista.run(contexto({
      transactions: { async byContact() { return { items: [] }; }, async recent() { return { items: [] }; } },
    }));
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/no expone/);
  });
});
