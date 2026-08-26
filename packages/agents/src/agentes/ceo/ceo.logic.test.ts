import { describe, it, expect } from "vitest";
import { resumenEjecutivo } from "./ceo.logic";

describe("resumenEjecutivo", () => {
  it("cuenta por severidad y selecciona el top por prioridad", () => {
    const r = resumenEjecutivo([
      { severidad: "critica", prioridad: 1, titulo: "A" },
      { severidad: "importante", prioridad: 3, titulo: "B" },
      { severidad: "oportunidad", prioridad: 2, titulo: "C" },
    ], 2);
    expect(r.conteos).toEqual({ criticas: 1, importantes: 1, oportunidades: 1 });
    expect(r.top.map((x) => x.titulo)).toEqual(["A", "C"]); // prioridad 1, 2
    expect(r.texto).toContain("Estado:");
  });
  it("sin recomendaciones → texto de 'en orden'", () => {
    expect(resumenEjecutivo([]).texto).toContain("en orden");
  });
});
