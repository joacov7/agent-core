import { describe, it, expect } from "vitest";
import { evaluarVenta } from "./ventas.logic";

describe("evaluarVenta", () => {
  it("pondera valor × probabilidad", () => {
    expect(evaluarVenta({ valorEstimado: 100000, probabilidad: 0.7 })).toMatchObject({ severidad: "importante", valorPonderado: 70000 });
  });
  it("baja probabilidad → oportunidad", () => {
    expect(evaluarVenta({ valorEstimado: 100000, probabilidad: 0.3 })?.severidad).toBe("oportunidad");
  });
  it("sin probabilidad usa el default", () => {
    expect(evaluarVenta({ valorEstimado: 200000 })?.valorPonderado).toBe(100000);
  });
  it("sin valor estimado → null", () => {
    expect(evaluarVenta({ valorEstimado: null, probabilidad: 0.9 })).toBeNull();
  });
});
