import { describe, it, expect } from "vitest";
import type {
  AgentContext, CanastaContacto, ParComplementario, ProviderRegistry, TenantCtx,
} from "@agent-core/contracts";
import { agenteOportunidades } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteOportunidades.run", () => {
  it("sin agregados → vacío con nota", async () => {
    const out = await agenteOportunidades.run(contexto({
      transactions: { async byContact() { return { items: [] }; }, async recent() { return { items: [] }; } },
    }));
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/no expone/);
  });

  it("sugiere el complementario que falta", async () => {
    const pares: ParComplementario[] = [
      { itemA: "mate", itemB: "bombilla", nombreA: "Mate", nombreB: "Bombilla", coOcurrencias: 6 },
    ];
    const canastas: CanastaContacto[] = [
      { contactoId: "c1", nombre: "Ana", itemIds: ["mate"] }, // tiene mate, le falta bombilla
    ];
    const providers: ProviderRegistry = {
      transactions: {
        async byContact() { return { items: [] }; },
        async recent() { return { items: [] }; },
        async paresComplementarios() { return pares; },
        async canastasPorContacto() { return { items: canastas }; },
      },
    };
    const out = await agenteOportunidades.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    const r = out.recomendaciones[0]!;
    expect(r.tipo).toBe("venta_cruzada");
    expect(r.refEntidad?.id).toBe("c1");
    expect(r.confianza).toBe(80); // co=6 → soporte alto
    expect(r.titulo).toContain("Bombilla");
  });
});
