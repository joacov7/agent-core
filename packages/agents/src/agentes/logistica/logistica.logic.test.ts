import { describe, it, expect } from "vitest";
import { evaluarEntrega } from "./logistica.logic";

const hoy = new Date("2026-08-25T00:00:00.000Z");

describe("evaluarEntrega", () => {
  it("demorada → crítica", () => {
    expect(evaluarEntrega({ estado: "pendiente", venceEn: "2026-08-22T00:00:00.000Z" }, hoy)?.severidad).toBe("critica");
  });
  it("inminente → importante", () => {
    expect(evaluarEntrega({ estado: "en_progreso", venceEn: "2026-08-26T00:00:00.000Z" }, hoy)?.severidad).toBe("importante");
  });
  it("entrega completada → sin alerta", () => {
    expect(evaluarEntrega({ estado: "completada", venceEn: "2026-08-01T00:00:00.000Z" }, hoy)).toBeNull();
  });
  it("lejana → sin alerta", () => {
    expect(evaluarEntrega({ estado: "pendiente", venceEn: "2026-09-30T00:00:00.000Z" }, hoy)).toBeNull();
  });
});
