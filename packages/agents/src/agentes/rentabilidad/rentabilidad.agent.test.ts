import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, ResumenItem, TenantCtx } from "@agent-core/contracts";
import { agenteRentabilidad } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteRentabilidad.run", () => {
  it("sin resumenRentabilidad → vacío con nota", async () => {
    const out = await agenteRentabilidad.run(contexto({
      catalog: { async items() { return { items: [] }; }, async get() { return null; } },
    }));
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/no expone/);
  });

  it("emite alertas de rentabilidad (margen bajo, inmovilizado)", async () => {
    const items: ResumenItem[] = [
      { catalogoItemId: "p1", nombre: "Mate", precio: 1000, costo: 900, margenPct: 10, ventas30d: 20, stock: 5, valorInmovilizado: 0 },
      { catalogoItemId: "p2", nombre: "Termo", precio: 5000, costo: 3000, margenPct: 40, ventas30d: 0, stock: 40, valorInmovilizado: 200000 },
      { catalogoItemId: "p3", nombre: "Yerba", precio: 800, costo: 500, margenPct: 37, ventas30d: 50, stock: 10, valorInmovilizado: 5000 },
    ];
    const providers: ProviderRegistry = {
      catalog: {
        async items() { return { items: [] }; },
        async get() { return null; },
        async resumenRentabilidad() { return { items }; },
      },
    };
    const out = await agenteRentabilidad.run(contexto(providers));
    const tipos = out.recomendaciones.map((r) => r.tipo);
    expect(tipos).toContain("margen_bajo");   // p1
    expect(tipos).toContain("inmovilizado");  // p2
    // p3 (margen 37%, alta rotación) no dispara alerta
    expect(out.recomendaciones.find((r) => r.refEntidad?.id === "p3")).toBeUndefined();
    expect(out.recomendaciones.every((r) => r.confianza === 90)).toBe(true); // origen "calculo"
  });
});
