import { describe, it, expect } from "vitest";
import { clasificarCobro, diasVencido } from "./cobros.logic";

describe("clasificarCobro", () => {
  it("vencido hace poco → importante", () => {
    expect(clasificarCobro({ estado: "pendiente", monto: 1000, diasVencido: 10 })?.severidad).toBe("importante");
  });
  it("vencido hace mucho → crítica", () => {
    expect(clasificarCobro({ estado: "vencido", monto: 1000, diasVencido: 45 })?.severidad).toBe("critica");
  });
  it("no vencido → sin alerta", () => {
    expect(clasificarCobro({ estado: "pendiente", monto: 1000, diasVencido: -5 })).toBeNull();
  });
  it("cobrado o incobrable → sin alerta", () => {
    expect(clasificarCobro({ estado: "cobrado", monto: 1000, diasVencido: 40 })).toBeNull();
    expect(clasificarCobro({ estado: "incobrable", monto: 1000, diasVencido: 40 })).toBeNull();
  });
  it("monto por debajo del umbral → sin alerta", () => {
    expect(clasificarCobro({ estado: "pendiente", monto: 0, diasVencido: 40 }, { diasCritico: 30, montoRelevante: 100 })).toBeNull();
  });
});

describe("diasVencido", () => {
  const hoy = new Date("2026-08-25T00:00:00.000Z");
  it("cuenta días desde el vencimiento", () => {
    expect(diasVencido("2026-08-15T00:00:00.000Z", hoy)).toBe(10);
  });
  it("futuro → negativo", () => {
    expect(diasVencido("2026-08-30T00:00:00.000Z", hoy)).toBe(-5);
  });
  it("sin vencimiento → 0", () => {
    expect(diasVencido(undefined, hoy)).toBe(0);
  });
});
