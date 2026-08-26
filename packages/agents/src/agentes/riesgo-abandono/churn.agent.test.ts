import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, ResumenContacto, TenantCtx } from "@agent-core/contracts";
import { agenteRiesgoAbandono } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteRiesgoAbandono.run", () => {
  it("marca al cliente que se pasó de su frecuencia", async () => {
    const items: ResumenContacto[] = [
      { contactoId: "perdido", compras: 6, totalGastado: 100, ticketPromedio: 16, diasDesdeUltima: 120, frecuenciaDias: 30 },
      { contactoId: "activo", compras: 5, totalGastado: 100, ticketPromedio: 20, diasDesdeUltima: 10, frecuenciaDias: 30 },
    ];
    const providers: ProviderRegistry = {
      transactions: {
        async byContact() { return { items: [] }; },
        async recent() { return { items: [] }; },
        async resumenPorContacto() { return { items }; },
      },
    };
    const out = await agenteRiesgoAbandono.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    expect(out.recomendaciones[0]!.tipo).toBe("churn_perdido");
    expect(out.recomendaciones[0]!.refEntidad?.id).toBe("perdido");
  });

  it("sin resumenPorContacto → vacío con nota", async () => {
    const out = await agenteRiesgoAbandono.run(contexto({
      transactions: { async byContact() { return { items: [] }; }, async recent() { return { items: [] }; } },
    }));
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/no expone/);
  });
});
