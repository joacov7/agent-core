import { describe, it, expect } from "vitest";
import { clasificarEvento, diasHasta } from "./agenda.logic";

const hoy = new Date("2026-08-25T00:00:00.000Z");

describe("diasHasta", () => {
  it("futuro positivo, pasado negativo", () => {
    expect(diasHasta("2026-08-28T00:00:00.000Z", hoy)).toBe(3);
    expect(diasHasta("2026-08-23T00:00:00.000Z", hoy)).toBe(-2);
  });
});

describe("clasificarEvento", () => {
  it("vencido → crítica", () => {
    expect(clasificarEvento("2026-08-20T00:00:00.000Z", hoy)?.severidad).toBe("critica");
  });
  it("inminente (<=2d) → importante", () => {
    expect(clasificarEvento("2026-08-26T00:00:00.000Z", hoy)?.severidad).toBe("importante");
  });
  it("próximo (<=7d) → oportunidad", () => {
    expect(clasificarEvento("2026-08-31T00:00:00.000Z", hoy)?.severidad).toBe("oportunidad");
  });
  it("lejano → sin alerta", () => {
    expect(clasificarEvento("2026-09-30T00:00:00.000Z", hoy)).toBeNull();
  });
});
