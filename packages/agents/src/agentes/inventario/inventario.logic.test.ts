import { describe, it, expect } from "vitest";
import { clasificarExistencia } from "./inventario.logic";

describe("clasificarExistencia", () => {
  it("sin stock → quiebre crítico", () => {
    expect(clasificarExistencia({ cantidad: 0, minimo: 5 })).toMatchObject({ tipo: "quiebre", severidad: "critica" });
  });
  it("por debajo del mínimo → reponer importante", () => {
    expect(clasificarExistencia({ cantidad: 3, minimo: 5 })).toMatchObject({ tipo: "reponer", severidad: "importante" });
  });
  it("stock suficiente → sin alerta", () => {
    expect(clasificarExistencia({ cantidad: 10, minimo: 5 })).toBeNull();
  });
  it("sin mínimo → solo alerta el quiebre", () => {
    expect(clasificarExistencia({ cantidad: 2 })).toBeNull();
    expect(clasificarExistencia({ cantidad: 0 })?.tipo).toBe("quiebre");
  });
});
