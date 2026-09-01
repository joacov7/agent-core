import { describe, it, expect } from "vitest";
import {
  aEscalaNps, clasificarNps, calcularNps, detractores, type RespuestaNps,
} from "./nps.logic.js";

function r(id: string, puntaje: number, escala = 10): RespuestaNps {
  return { id, contactoId: null, puntaje, escala, comentario: null };
}

describe("aEscalaNps", () => {
  it("deja igual una escala 0..10 y normaliza otras", () => {
    expect(aEscalaNps(8, 10)).toBe(8);
    expect(aEscalaNps(4, 5)).toBe(8);   // 4/5 → 8/10
    expect(aEscalaNps(1, 5)).toBe(2);
  });
  it("clamp y escala inválida", () => {
    expect(aEscalaNps(12, 10)).toBe(10);
    expect(aEscalaNps(5, 0)).toBe(0);
  });
});

describe("clasificarNps", () => {
  it("promotor 9-10, pasivo 7-8, detractor 0-6", () => {
    expect(clasificarNps(10)).toBe("promotor");
    expect(clasificarNps(9)).toBe("promotor");
    expect(clasificarNps(8)).toBe("pasivo");
    expect(clasificarNps(7)).toBe("pasivo");
    expect(clasificarNps(6)).toBe("detractor");
    expect(clasificarNps(0)).toBe("detractor");
  });
});

describe("calcularNps", () => {
  it("% promotores − % detractores, redondeado", () => {
    // 2 promotores, 1 pasivo, 1 detractor → (50 - 25) = 25
    const res = calcularNps([r("a", 10), r("b", 9), r("c", 7), r("d", 3)]);
    expect(res).toEqual({ nps: 25, total: 4, promotores: 2, pasivos: 1, detractores: 1 });
  });
  it("sin respuestas → nps 0", () => {
    expect(calcularNps([])).toEqual({ nps: 0, total: 0, promotores: 0, pasivos: 0, detractores: 0 });
  });
  it("normaliza escalas distintas", () => {
    // 5/5 = promotor(10), 1/5 = detractor(2) → (50 - 50) = 0
    expect(calcularNps([r("a", 5, 5), r("b", 1, 5)]).nps).toBe(0);
  });
});

describe("detractores", () => {
  it("filtra solo los detractores, en orden", () => {
    const ds = detractores([r("a", 10), r("b", 4), r("c", 8), r("d", 0)]);
    expect(ds.map((x) => x.id)).toEqual(["b", "d"]);
  });
});
