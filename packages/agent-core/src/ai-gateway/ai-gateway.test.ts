import { describe, it, expect } from "vitest";
import type {
  AiCompletionProvider, AiUsage, GastoIA, GastoStore, TarifarioIA, TenantCtx,
} from "@agent-core/contracts";
import { crearAiGateway, calcularCosto, PresupuestoExcedidoError } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", requestId: "req-1" };
const tarifario: TarifarioIA = { m1: { entradaPor1k: 0.01, salidaPor1k: 0.03 } };
const deterministas = { generarId: () => "g-1", now: () => new Date("2026-01-01T00:00:00.000Z") };

function provider(
  usage: AiUsage = { inputTokens: 1000, outputTokens: 1000 }, model = "m1",
): AiCompletionProvider {
  return { async complete() { return { text: "ok", model, usage }; } };
}

function gastoStoreFake(): GastoStore & { _rows: GastoIA[] } {
  const rows: GastoIA[] = [];
  return {
    _rows: rows,
    async registrar(_ctx, g) { rows.push(g); return g; },
    async totalPorTenant(c) { return rows.filter((r) => r.tenantId === c.tenantId).reduce((s, r) => s + r.costo, 0); },
    async totalPorAgente(c, agentId) {
      return rows.filter((r) => r.tenantId === c.tenantId && r.agentId === agentId).reduce((s, r) => s + r.costo, 0);
    },
  };
}

describe("calcularCosto", () => {
  it("deriva el costo desde los tokens y el tarifario", () => {
    expect(calcularCosto("m1", { inputTokens: 1000, outputTokens: 1000 }, tarifario)).toBe(0.04);
    expect(calcularCosto("m1", { inputTokens: 500, outputTokens: 0 }, tarifario)).toBe(0.005);
  });
  it("sin tarifario para el modelo → costo 0", () => {
    expect(calcularCosto("desconocido", { inputTokens: 9999, outputTokens: 9999 }, tarifario)).toBe(0);
    expect(calcularCosto("m1", { inputTokens: 1000, outputTokens: 1000 })).toBe(0);
  });
});

describe("crearAiGateway", () => {
  it("falla cerrado sin TenantCtx", async () => {
    const gw = crearAiGateway({ provider: provider() });
    await expect(gw.complete({} as TenantCtx, { messages: [] })).rejects.toThrow(/TenantCtx/);
  });

  it("delega en el proveedor y devuelve su respuesta", async () => {
    const gw = crearAiGateway({ provider: provider() });
    const res = await gw.complete(ctx, { messages: [{ role: "user", content: "hola" }] });
    expect(res).toMatchObject({ text: "ok", model: "m1" });
  });

  it("atribuye y persiste el gasto por tenant/agente", async () => {
    const store = gastoStoreFake();
    const gw = crearAiGateway({ provider: provider(), tarifario, gastoStore: store, moneda: "USD", ...deterministas });
    await gw.complete(ctx, { messages: [], agentId: "crm" });
    expect(store._rows).toHaveLength(1);
    expect(store._rows[0]).toMatchObject({
      tenantId: "t1", agentId: "crm", model: "m1", costo: 0.04, moneda: "USD", requestId: "req-1",
    });
  });

  it("aplica el presupuesto por tenant (falla cerrado al superarlo)", async () => {
    const gw = crearAiGateway({ provider: provider(), tarifario, presupuesto: { maxPorTenant: 0.04 } });
    await gw.complete(ctx, { messages: [] });               // 0 < 0.04 → ok, acumula 0.04
    await expect(gw.complete(ctx, { messages: [] }))         // 0.04 >= 0.04 → bloquea
      .rejects.toBeInstanceOf(PresupuestoExcedidoError);
  });

  it("aplica el presupuesto por agente", async () => {
    const gw = crearAiGateway({ provider: provider(), tarifario, presupuesto: { maxPorAgente: { crm: 0.04 } } });
    await gw.complete(ctx, { messages: [], agentId: "crm" });
    await expect(gw.complete(ctx, { messages: [], agentId: "crm" }))
      .rejects.toBeInstanceOf(PresupuestoExcedidoError);
    // otro agente sin tope → sigue pasando
    await expect(gw.complete(ctx, { messages: [], agentId: "ceo" })).resolves.toMatchObject({ text: "ok" });
  });

  it("usa el gastoStore como fuente autoritativa del presupuesto", async () => {
    const store = gastoStoreFake();
    const gw = crearAiGateway({ provider: provider(), tarifario, gastoStore: store, presupuesto: { maxPorTenant: 0.04 } });
    await gw.complete(ctx, { messages: [] });
    expect(store._rows).toHaveLength(1);
    await expect(gw.complete(ctx, { messages: [] })).rejects.toBeInstanceOf(PresupuestoExcedidoError);
  });
});
