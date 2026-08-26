import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, ResumenContacto, TenantCtx } from "@agent-core/contracts";
import { agentePostventa } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agentePostventa.run", () => {
  it("pide reseña a compra reciente y recompra en ventana; ignora al churn", async () => {
    const items: ResumenContacto[] = [
      { contactoId: "reciente", compras: 2, totalGastado: 100, ticketPromedio: 50, diasDesdeUltima: 3, frecuenciaDias: 30 },
      { contactoId: "recompra", compras: 4, totalGastado: 100, ticketPromedio: 25, diasDesdeUltima: 28, frecuenciaDias: 30 },
      { contactoId: "churn", compras: 5, totalGastado: 100, ticketPromedio: 20, diasDesdeUltima: 200, frecuenciaDias: 30 },
    ];
    const providers: ProviderRegistry = {
      transactions: {
        async byContact() { return { items: [] }; },
        async recent() { return { items: [] }; },
        async resumenPorContacto() { return { items }; },
      },
    };
    const out = await agentePostventa.run(contexto(providers));
    const tipos = out.recomendaciones.map((r) => r.tipo);
    expect(tipos).toContain("postventa_resena");
    expect(tipos).toContain("postventa_recompra");
    expect(out.recomendaciones.find((r) => r.refEntidad?.id === "churn")).toBeUndefined();
  });

  it("sin resumenPorContacto → vacío con nota", async () => {
    const out = await agentePostventa.run(contexto({
      transactions: { async byContact() { return { items: [] }; }, async recent() { return { items: [] }; } },
    }));
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/no expone/);
  });
});
