import { describe, it, expect } from "vitest";
import { scoreCliente, ameritaReactivacion } from "./crm.logic";
import type { MetricasCliente } from "./crm.logic";

function cli(o: Partial<MetricasCliente>): MetricasCliente {
  return {
    key: "c1", nombre: "Cliente", email: "c@x.com", telefono: null,
    compras: 4, total_gastado: 400000, ticket_promedio: 100000,
    ultima_compra: new Date().toISOString(), dias_desde_ultima: 10, frecuencia_dias: 30,
    ...o,
  };
}

describe("scoreCliente", () => {
  it("cliente top (alto valor, reciente, frecuente) → score alto, riesgo bajo", () => {
    const s = scoreCliente(cli({ total_gastado: 1000000, dias_desde_ultima: 5, compras: 6 }), { maxValor: 1000000 });
    expect(s.score).toBeGreaterThanOrEqual(80);
    expect(s.riesgo_abandono).toBe("bajo");
  });

  it("pasó 1.5x su frecuencia → riesgo alto", () => {
    const s = scoreCliente(cli({ frecuencia_dias: 30, dias_desde_ultima: 50 }), { maxValor: 400000 });
    expect(s.riesgo_abandono).toBe("alto");
  });

  it("entre 1x y 1.5x la frecuencia → riesgo medio", () => {
    const s = scoreCliente(cli({ frecuencia_dias: 30, dias_desde_ultima: 40 }), { maxValor: 400000 });
    expect(s.riesgo_abandono).toBe("medio");
  });

  it("1 sola compra → usa umbral por defecto y confianza baja", () => {
    const s = scoreCliente(cli({ compras: 1, frecuencia_dias: null, dias_desde_ultima: 100 }), { maxValor: 400000 });
    expect(s.confianza).toBe(45);
    expect(s.riesgo_abandono).toBe("alto"); // 100 > 60*1.5
  });

  it("score en rango 0-100", () => {
    const s = scoreCliente(cli({ total_gastado: 0, dias_desde_ultima: 999, compras: 1, frecuencia_dias: null }), { maxValor: 1000000 });
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });

  it("cohorte sin valor (maxValor 0) no rompe", () => {
    const s = scoreCliente(cli({ total_gastado: 0 }), { maxValor: 0 });
    expect(Number.isFinite(s.score)).toBe(true);
  });
});

describe("ameritaReactivacion", () => {
  const ctx = { maxValor: 1000000 };
  it("cliente valioso en riesgo alto con 2+ compras → sí", () => {
    const m = cli({ total_gastado: 400000, compras: 3, frecuencia_dias: 30, dias_desde_ultima: 60 });
    const s = scoreCliente(m, ctx);
    expect(ameritaReactivacion(m, s, ctx)).toBe(true);
  });
  it("cliente de bajo valor en riesgo → no (evita ruido)", () => {
    const m = cli({ total_gastado: 50000, compras: 3, frecuencia_dias: 30, dias_desde_ultima: 60 });
    const s = scoreCliente(m, ctx);
    expect(ameritaReactivacion(m, s, ctx)).toBe(false);
  });
  it("cliente valioso sin riesgo → no", () => {
    const m = cli({ total_gastado: 500000, compras: 4, frecuencia_dias: 30, dias_desde_ultima: 10 });
    const s = scoreCliente(m, ctx);
    expect(ameritaReactivacion(m, s, ctx)).toBe(false);
  });
  it("una sola compra → no reactiva (poca historia)", () => {
    const m = cli({ total_gastado: 500000, compras: 1, frecuencia_dias: null, dias_desde_ultima: 200 });
    const s = scoreCliente(m, ctx);
    expect(ameritaReactivacion(m, s, ctx)).toBe(false);
  });
});
