import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, ResumenContacto, TenantCtx } from "@agent-core/contracts";
import { agenteCrm } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

function resumen(over: Partial<ResumenContacto>): ResumenContacto {
  return {
    contactoId: "c1", compras: 5, totalGastado: 500000, ticketPromedio: 100000,
    ultimaTransaccion: new Date().toISOString(), diasDesdeUltima: 10, frecuenciaDias: 30, ...over,
  };
}

describe("agenteCrm.run", () => {
  it("sin resumenPorContacto → vacío con nota", async () => {
    const out = await agenteCrm.run(contexto({ transactions: { async byContact() { return { items: [] }; }, async recent() { return { items: [] }; } } }));
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/no expone/);
  });

  it("recomienda reactivar a un cliente valioso en riesgo", async () => {
    const items: ResumenContacto[] = [
      resumen({ contactoId: "vip", totalGastado: 1_000_000, compras: 6, diasDesdeUltima: 120, frecuenciaDias: 30 }),
      resumen({ contactoId: "ok", totalGastado: 200_000, compras: 4, diasDesdeUltima: 5, frecuenciaDias: 30 }),
    ];
    const providers: ProviderRegistry = {
      transactions: {
        async byContact() { return { items: [] }; },
        async recent() { return { items: [] }; },
        async resumenPorContacto() { return { items }; },
      },
    };
    const out = await agenteCrm.run(contexto(providers));
    expect(out.recomendaciones.length).toBeGreaterThanOrEqual(1);
    const vip = out.recomendaciones.find((r) => r.refEntidad?.id === "vip");
    expect(vip).toBeDefined();
    expect(vip?.tipo).toBe("reactivacion");
    expect(vip?.agentId).toBe("crm");
  });
});
