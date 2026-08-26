import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteFlujoCaja } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T00:00:00.000Z") };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteFlujoCaja.run", () => {
  it("alerta déficit de corto plazo (egreso > ingreso en la ventana)", async () => {
    const providers: ProviderRegistry = {
      receivables: {
        async pending() {
          return { items: [
            { id: "c1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", contactoId: "x", estado: "pendiente", monto: 10000, venceEn: "2026-09-10T00:00:00.000Z" }, // 16d → 8-30
          ] };
        },
        async overdue() { return { items: [] }; },
      },
      suppliers: {
        async list() { return { items: [] }; },
        async purchases() {
          return { items: [
            { id: "p1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", proveedorId: "s", estado: "pendiente", monto: 50000, fecha: "2026-09-12T00:00:00.000Z" }, // 18d → 8-30
          ] };
        },
      },
    };
    const out = await agenteFlujoCaja.run(contexto(providers));
    const deficit = out.recomendaciones.find((r) => r.tipo === "flujo_negativo");
    expect(deficit).toBeDefined();
    expect(deficit!.impactoEstimado).toBe(-40000); // 10000 - 50000
    expect(out.resumen).toContain("neto");
  });

  it("sin déficit de corto plazo → sin alertas, con resumen", async () => {
    const providers: ProviderRegistry = {
      receivables: {
        async pending() {
          return { items: [
            { id: "c1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", contactoId: "x", estado: "pendiente", monto: 90000, venceEn: "2026-08-28T00:00:00.000Z" },
          ] };
        },
        async overdue() { return { items: [] }; },
      },
    };
    const out = await agenteFlujoCaja.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toContain("Proyección");
  });

  it("sin receivables → vacío", async () => {
    expect((await agenteFlujoCaja.run(contexto({}))).recomendaciones).toHaveLength(0);
  });
});
