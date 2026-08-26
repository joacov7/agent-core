import { describe, it, expect } from "vitest";
import { evaluarSeguimiento } from "./seguimiento.logic";

const hoy = new Date("2026-08-25T00:00:00.000Z");

describe("evaluarSeguimiento", () => {
  it("sin cierre estimado → sin próximo paso (oportunidad)", () => {
    expect(evaluarSeguimiento({}, hoy)).toMatchObject({ severidad: "oportunidad" });
  });
  it("cierre vencido → importante", () => {
    const a = evaluarSeguimiento({ cierreEstimado: "2026-08-20T00:00:00.000Z" }, hoy);
    expect(a?.severidad).toBe("importante");
    expect(a?.motivo).toContain("vencido");
  });
  it("por cerrar pronto → importante", () => {
    expect(evaluarSeguimiento({ cierreEstimado: "2026-08-29T00:00:00.000Z" }, hoy)?.motivo).toContain("por cerrar");
  });
  it("cierre cómodo en el futuro → sin alerta", () => {
    expect(evaluarSeguimiento({ cierreEstimado: "2026-10-01T00:00:00.000Z" }, hoy)).toBeNull();
  });
});
