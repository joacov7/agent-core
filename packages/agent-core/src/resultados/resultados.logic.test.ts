import { describe, it, expect } from "vitest";
import { agregarMetricas, esPositivo, esNegativo } from "./resultados.logic";

describe("clasificación de resultados", () => {
  it("solo 'compro' es positivo", () => {
    expect(esPositivo("compro")).toBe(true);
    expect(esPositivo("ejecutada")).toBe(false);
    expect(esPositivo("respondio")).toBe(false);
  });
  it("rechazado/no_respondio/sin_whatsapp/error son negativos", () => {
    expect(esNegativo("rechazado")).toBe(true);
    expect(esNegativo("no_respondio")).toBe(true);
    expect(esNegativo("sin_whatsapp")).toBe(true);
    expect(esNegativo("error")).toBe(true);
    expect(esNegativo("compro")).toBe(false);
    expect(esNegativo("ejecutada")).toBe(false);
  });
});

describe("agregarMetricas", () => {
  it("cuenta por tipo, positivos, negativos", () => {
    const m = agregarMetricas([
      { tipo: "ejecutada", valor_real: null },
      { tipo: "compro", valor_real: 15000 },
      { tipo: "compro", valor_real: 8000 },
      { tipo: "no_respondio", valor_real: null },
    ]);
    expect(m.total).toBe(4);
    expect(m.porTipo).toEqual({ ejecutada: 1, compro: 2, no_respondio: 1 });
    expect(m.positivos).toBe(2);
    expect(m.negativos).toBe(1);
  });

  it("suma SOLO el valor real medido (no inventa)", () => {
    const m = agregarMetricas([
      { tipo: "compro", valor_real: 15000 },
      { tipo: "compro", valor_real: null }, // venta sin monto conocido → no suma
      { tipo: "ejecutada", valor_real: null },
    ]);
    expect(m.valorRealTotal).toBe(15000);
    expect(m.conValorReal).toBe(1); // solo 1 aportó valor real
  });

  it("sin resultados → métricas en cero", () => {
    const m = agregarMetricas([]);
    expect(m.total).toBe(0);
    expect(m.valorRealTotal).toBe(0);
    expect(m.positivos).toBe(0);
  });
});
