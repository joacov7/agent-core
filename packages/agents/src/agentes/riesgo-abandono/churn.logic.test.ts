import { describe, it, expect } from "vitest";
import { evaluarChurn } from "./churn.logic";

describe("evaluarChurn", () => {
  it("dentro de su frecuencia → sin alerta", () => {
    expect(evaluarChurn({ compras: 5, diasDesdeUltima: 20, frecuenciaDias: 30 })).toBeNull();
  });
  it("se pasó un poco → en_riesgo (oportunidad)", () => {
    const a = evaluarChurn({ compras: 5, diasDesdeUltima: 35, frecuenciaDias: 30 });
    expect(a?.nivel).toBe("en_riesgo");
    expect(a?.severidad).toBe("oportunidad");
  });
  it("bastante pasado → probable (importante)", () => {
    expect(evaluarChurn({ compras: 5, diasDesdeUltima: 60, frecuenciaDias: 30 })?.nivel).toBe("probable");
  });
  it("muy pasado → perdido", () => {
    const a = evaluarChurn({ compras: 6, diasDesdeUltima: 120, frecuenciaDias: 30 });
    expect(a?.nivel).toBe("perdido");
    expect(a?.ratio).toBe(4);
  });
  it("poca historia → no opina", () => {
    expect(evaluarChurn({ compras: 1, diasDesdeUltima: 200, frecuenciaDias: 30 })).toBeNull();
  });
  it("sin frecuencia usa el default", () => {
    expect(evaluarChurn({ compras: 3, diasDesdeUltima: 70, frecuenciaDias: null })?.nivel).toBe("en_riesgo");
  });
});
