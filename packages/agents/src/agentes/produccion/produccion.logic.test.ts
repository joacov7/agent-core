import { describe, it, expect } from "vitest";
import { evaluarProceso } from "./produccion.logic";

const hoy = new Date("2026-08-25T00:00:00.000Z");

describe("evaluarProceso", () => {
  it("proceso demorado → crítica", () => {
    expect(evaluarProceso({ estado: "en_progreso", venceEn: "2026-08-24T00:00:00.000Z" }, hoy)?.severidad).toBe("critica");
  });
  it("por vencer → importante", () => {
    expect(evaluarProceso({ estado: "pendiente", venceEn: "2026-08-26T00:00:00.000Z" }, hoy)?.severidad).toBe("importante");
  });
  it("completado → sin alerta", () => {
    expect(evaluarProceso({ estado: "completada", venceEn: "2026-08-01T00:00:00.000Z" }, hoy)).toBeNull();
  });
  it("lejano → sin alerta", () => {
    expect(evaluarProceso({ estado: "pendiente", venceEn: "2026-09-15T00:00:00.000Z" }, hoy)).toBeNull();
  });
});
