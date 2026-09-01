import { describe, it, expect } from "vitest";
import {
  clasificarPreventivo, diasHastaVencimiento, UMBRALES_PREVENTIVO_DEFAULT,
} from "./cobranza-preventiva.logic.js";

const HOY = new Date("2026-08-25T12:00:00.000Z");

describe("diasHastaVencimiento", () => {
  it("es positivo si el vencimiento es futuro, negativo si ya pasó", () => {
    expect(diasHastaVencimiento("2026-08-28T12:00:00.000Z", HOY)).toBe(3);
    expect(diasHastaVencimiento("2026-08-20T12:00:00.000Z", HOY)).toBe(-5);
  });
  it("null si no hay vencimiento", () => {
    expect(diasHastaVencimiento(undefined, HOY)).toBeNull();
  });
});

describe("clasificarPreventivo", () => {
  it("importante si vence dentro de diasProximo", () => {
    const a = clasificarPreventivo({ estado: "pendiente", monto: 1000, diasHastaVencimiento: 2 });
    expect(a?.severidad).toBe("importante");
    expect(a?.motivo).toMatch(/en 2 día/);
  });
  it("oportunidad si vence entre diasProximo y diasAviso", () => {
    const a = clasificarPreventivo({ estado: "pendiente", monto: 1000, diasHastaVencimiento: 6 });
    expect(a?.severidad).toBe("oportunidad");
  });
  it("dice 'hoy' cuando vence hoy", () => {
    const a = clasificarPreventivo({ estado: "pendiente", monto: 1000, diasHastaVencimiento: 0 });
    expect(a?.severidad).toBe("importante");
    expect(a?.motivo).toBe("vence hoy");
  });
  it("null si ya venció (eso es de Cobros)", () => {
    expect(clasificarPreventivo({ estado: "vencido", monto: 1000, diasHastaVencimiento: -1 })).toBeNull();
  });
  it("null si todavía está muy lejos", () => {
    expect(clasificarPreventivo({ estado: "pendiente", monto: 1000, diasHastaVencimiento: 30 })).toBeNull();
  });
  it("null si ya está cobrado o es incobrable", () => {
    expect(clasificarPreventivo({ estado: "cobrado", monto: 1000, diasHastaVencimiento: 2 })).toBeNull();
    expect(clasificarPreventivo({ estado: "incobrable", monto: 1000, diasHastaVencimiento: 2 })).toBeNull();
  });
  it("null si el monto no es relevante", () => {
    const u = { ...UMBRALES_PREVENTIVO_DEFAULT, montoRelevante: 5000 };
    expect(clasificarPreventivo({ estado: "pendiente", monto: 1000, diasHastaVencimiento: 2 }, u)).toBeNull();
  });
});
