import { describe, it, expect } from "vitest";
import {
  esObligacion, estaRespaldada, clasificarObligacion,
  type ObligacionInput, type RespaldoDoc,
} from "./compliance.logic.js";

describe("esObligacion", () => {
  it("detecta tipos de obligación por inclusión, case-insensitive", () => {
    expect(esObligacion("vencimiento_afip")).toBe(true);
    expect(esObligacion("Presentacion")).toBe(true);
    expect(esObligacion("audiencia")).toBe(true);
    expect(esObligacion("reunion_interna")).toBe(false);
    expect(esObligacion("turno")).toBe(false);
  });
});

describe("estaRespaldada", () => {
  const ob: ObligacionInput = { id: "ev1", tipo: "presentacion", titulo: "X", diasHasta: 3, refEntidadId: "exp1" };
  it("true si un documento apunta al evento", () => {
    const docs: RespaldoDoc[] = [{ refEntidadId: "ev1" }];
    expect(estaRespaldada(ob, docs)).toBe(true);
  });
  it("true si un documento apunta a la misma entidad de la obligación", () => {
    const docs: RespaldoDoc[] = [{ refEntidadId: "exp1" }];
    expect(estaRespaldada(ob, docs)).toBe(true);
  });
  it("false si ningún documento coincide", () => {
    expect(estaRespaldada(ob, [{ refEntidadId: "otro" }, { refEntidadId: null }])).toBe(false);
  });
});

describe("clasificarObligacion", () => {
  it("crítica si está próxima y SIN respaldo", () => {
    const a = clasificarObligacion(3, false);
    expect(a?.severidad).toBe("critica");
    expect(a?.motivo).toMatch(/sin respaldo/);
  });
  it("importante si está próxima y con respaldo", () => {
    expect(clasificarObligacion(3, true)?.severidad).toBe("importante");
  });
  it("crítica si está vencida y sin respaldo; importante si vencida con respaldo", () => {
    expect(clasificarObligacion(-2, false)?.severidad).toBe("critica");
    expect(clasificarObligacion(-2, true)?.severidad).toBe("importante");
  });
  it("aviso temprano: importante sin respaldo, oportunidad con respaldo", () => {
    expect(clasificarObligacion(10, false)?.severidad).toBe("importante");
    expect(clasificarObligacion(10, true)?.severidad).toBe("oportunidad");
  });
  it("null si está demasiado lejos", () => {
    expect(clasificarObligacion(30, false)).toBeNull();
  });
});
