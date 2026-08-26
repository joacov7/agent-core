import { describe, it, expect } from "vitest";
import { evaluarPostventa } from "./postventa.logic";

describe("evaluarPostventa", () => {
  it("compra reciente → reseña", () => {
    expect(evaluarPostventa({ compras: 2, diasDesdeUltima: 5, frecuenciaDias: 30 })).toMatchObject({ tipo: "resena", severidad: "oportunidad" });
  });
  it("en ventana de recompra → recompra", () => {
    expect(evaluarPostventa({ compras: 3, diasDesdeUltima: 28, frecuenciaDias: 30 })).toMatchObject({ tipo: "recompra", severidad: "importante" });
  });
  it("fuera de ventana (ya churn) → null", () => {
    expect(evaluarPostventa({ compras: 3, diasDesdeUltima: 120, frecuenciaDias: 30 })).toBeNull();
  });
  it("sin compras → null", () => {
    expect(evaluarPostventa({ compras: 0, diasDesdeUltima: 3, frecuenciaDias: 30 })).toBeNull();
  });
});
