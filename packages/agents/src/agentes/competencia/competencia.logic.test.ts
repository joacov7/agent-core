import { describe, it, expect } from "vitest";
import { posicionMercado } from "./competencia.logic";

describe("posicionMercado", () => {
  it("caros vs mercado → por_encima (importante)", () => {
    const a = posicionMercado(1200, 900);
    expect(a?.posicion).toBe("por_encima");
    expect(a?.gapPct).toBeCloseTo(33.3, 1);
    expect(a?.severidad).toBe("importante");
  });
  it("baratos vs mercado → por_debajo (oportunidad)", () => {
    expect(posicionMercado(800, 1000)?.posicion).toBe("por_debajo");
  });
  it("dentro de la tolerancia → en línea (null)", () => {
    expect(posicionMercado(1020, 1000)).toBeNull();
  });
  it("sin precio de mercado → null", () => {
    expect(posicionMercado(1000, 0)).toBeNull();
  });
});
