import { describe, it, expect } from "vitest";
import { resolvePolicy, evaluar, POLICIES_DEFAULT } from "./policies.logic";
import type { EvalContext } from "./policies.logic";

// Contexto base: tool de escritura genérica, sin límites, agente manual.
function ctx(over: Partial<EvalContext> = {}): EvalContext {
  return {
    tool: "aplicar_precio",
    resolved: { allowed: true },
    global: {},
    agentAutonomy: "manual",
    toolInput: {},
    hora: 12,
    ejecutadasEnRun: 0,
    ejecutadasHoy: 0,
    precioActual: null,
    costoActual: null,
    ...over,
  };
}

describe("resolvePolicy — precedencia", () => {
  it("perAgentTool pisa a tools, que pisa el default", () => {
    const cfg = {
      tools: { aplicar_precio: { max_items_per_run: 20, autonomy: "assisted" as const } },
      perAgentTool: { comercial: { aplicar_precio: { max_items_per_run: 5 } } },
    };
    const r = resolvePolicy(cfg, "comercial", "aplicar_precio");
    expect(r.allowed).toBe(true);          // default seguro
    expect(r.autonomy).toBe("assisted");   // de tools
    expect(r.max_items_per_run).toBe(5);   // override por agente
  });
  it("sin config → allowed true y sin límites (no cambia comportamiento)", () => {
    const r = resolvePolicy(POLICIES_DEFAULT, "x", "enviar_whatsapp");
    expect(r.allowed).toBe(true);
    expect(r.max_items_per_run).toBeUndefined();
  });
});

describe("evaluar — habilitación y autonomía", () => {
  it("default manual → permitido pero requiere aprobación", () => {
    const r = evaluar(ctx());
    expect(r.allow).toBe(true);
    expect(r.requireApproval).toBe(true);
  });
  it("agente autónomo con default → se ejecuta solo", () => {
    const r = evaluar(ctx({ agentAutonomy: "autonomous" }));
    expect(r.allow).toBe(true);
    expect(r.requireApproval).toBe(false);
  });
  it("autonomía por tool pisa la del agente", () => {
    const r = evaluar(ctx({ agentAutonomy: "autonomous", resolved: { allowed: true, autonomy: "manual" } }));
    expect(r.requireApproval).toBe(true);
  });
  it("requires_approval fuerza aprobación aunque sea autónomo", () => {
    const r = evaluar(ctx({ agentAutonomy: "autonomous", resolved: { allowed: true, requires_approval: true } }));
    expect(r.requireApproval).toBe(true);
  });
  it("allowed=false bloquea", () => {
    const r = evaluar(ctx({ resolved: { allowed: false } }));
    expect(r.allow).toBe(false);
  });
});

describe("evaluar — entidades protegidas", () => {
  it("producto protegido bloquea", () => {
    const r = evaluar(ctx({ toolInput: { productId: "P1", precio: 100 }, global: { protected_products: ["P1"] } }));
    expect(r.allow).toBe(false);
    expect(r.motivo).toContain("protegido");
  });
  it("cliente protegido bloquea (enviar_whatsapp)", () => {
    const r = evaluar(ctx({ tool: "enviar_whatsapp", toolInput: { to: "549111" }, global: { protected_clients: ["549111"] } }));
    expect(r.allow).toBe(false);
  });
});

describe("evaluar — horario WhatsApp", () => {
  it("fuera de horario bloquea", () => {
    const r = evaluar(ctx({ tool: "enviar_whatsapp", hora: 23, global: { whatsapp_allowed_hours: { from: 9, to: 21 } } }));
    expect(r.allow).toBe(false);
    expect(r.motivo).toContain("horario");
  });
  it("dentro de horario permite", () => {
    const r = evaluar(ctx({ tool: "enviar_whatsapp", hora: 10, agentAutonomy: "autonomous", global: { whatsapp_allowed_hours: { from: 9, to: 21 } } }));
    expect(r.allow).toBe(true);
  });
});

describe("evaluar — límites de cantidad", () => {
  it("max_items_per_run bloquea al alcanzarlo", () => {
    const r = evaluar(ctx({ resolved: { allowed: true, max_items_per_run: 3 }, ejecutadasEnRun: 3 }));
    expect(r.allow).toBe(false);
    expect(r.motivo).toContain("por ejecución");
  });
  it("max_daily_actions bloquea", () => {
    const r = evaluar(ctx({ resolved: { allowed: true, max_daily_actions: 20 }, ejecutadasHoy: 20 }));
    expect(r.allow).toBe(false);
    expect(r.motivo).toContain("diario");
  });
  it("tope diario global de whatsapp se aplica si no hay override", () => {
    const r = evaluar(ctx({ tool: "enviar_whatsapp", global: { max_whatsapp_daily: 50 }, ejecutadasHoy: 50 }));
    expect(r.allow).toBe(false);
  });
});

describe("evaluar — reglas de precio", () => {
  it("cambio mayor al max_change_percent bloquea", () => {
    const r = evaluar(ctx({ resolved: { allowed: true, max_change_percent: 5 }, precioActual: 100, toolInput: { precio: 120 } }));
    expect(r.allow).toBe(false);
    expect(r.motivo).toContain("supera el máximo");
  });
  it("cambio dentro del límite permite", () => {
    const r = evaluar(ctx({ agentAutonomy: "autonomous", resolved: { allowed: true, max_change_percent: 5 }, precioActual: 100, toolInput: { precio: 104 } }));
    expect(r.allow).toBe(true);
  });
  it("aumento mayor al global bloquea", () => {
    const r = evaluar(ctx({ precioActual: 100, toolInput: { precio: 130 }, global: { max_price_increase_pct: 15 } }));
    expect(r.allow).toBe(false);
  });
  it("descuento mayor al global bloquea", () => {
    const r = evaluar(ctx({ precioActual: 100, toolInput: { precio: 60 }, global: { max_discount_pct: 30 } }));
    expect(r.allow).toBe(false);
  });
  it("margen por debajo del mínimo bloquea", () => {
    // precio 100, costo 90 → margen 10% < 25%
    const r = evaluar(ctx({ precioActual: 100, costoActual: 90, toolInput: { precio: 100 }, global: { min_margin_pct: 25 } }));
    expect(r.allow).toBe(false);
    expect(r.motivo).toContain("margen");
  });
  it("margen ok no bloquea", () => {
    // precio 100, costo 50 → margen 50% ≥ 25%
    const r = evaluar(ctx({ agentAutonomy: "autonomous", precioActual: 100, costoActual: 50, toolInput: { precio: 100 }, global: { min_margin_pct: 25 } }));
    expect(r.allow).toBe(true);
  });
});
