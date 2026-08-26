import { describe, it, expect } from "vitest";
import { calcularReposicion } from "./compras.logic";

describe("calcularReposicion", () => {
  it("quiebre → crítica, repone hasta 2× el mínimo", () => {
    expect(calcularReposicion({ cantidad: 0, minimo: 5 })).toMatchObject({ severidad: "critica", cantidadSugerida: 10 });
  });
  it("bajo el mínimo → importante, completa hasta 2× el mínimo", () => {
    expect(calcularReposicion({ cantidad: 3, minimo: 5 })).toMatchObject({ severidad: "importante", cantidadSugerida: 7 });
  });
  it("stock suficiente → sin compra", () => {
    expect(calcularReposicion({ cantidad: 20, minimo: 5 })).toBeNull();
  });
});
