import { describe, it, expect } from "vitest";
import {
  esProduccion, esRelevante, puntuarIncidente, severidadDeScore, priorizarIncidentes,
  type IncidenteInput,
} from "./sistemas.logic.js";

const HOY = new Date("2026-08-25T12:00:00.000Z");

function inc(p: Partial<IncidenteInput> & Pick<IncidenteInput, "id" | "firma">): IncidenteInput {
  return {
    titulo: "Error X", servicio: null, entorno: null, nivel: "error",
    ocurrencias: 1, usuariosAfectados: null, ultimaVez: HOY.toISOString(), estado: "abierto", ...p,
  };
}

describe("esProduccion", () => {
  it("reconoce prod/produccion/production, case-insensitive", () => {
    expect(esProduccion("prod")).toBe(true);
    expect(esProduccion("Produccion")).toBe(true);
    expect(esProduccion("PRODUCTION")).toBe(true);
    expect(esProduccion("staging")).toBe(false);
    expect(esProduccion(null)).toBe(false);
  });
});

describe("esRelevante", () => {
  it("descarta resueltos, ignorados y cerrados", () => {
    expect(esRelevante({ estado: "abierto" })).toBe(true);
    expect(esRelevante({ estado: "resuelto" })).toBe(false);
    expect(esRelevante({ estado: "ignorado" })).toBe(false);
    expect(esRelevante({ estado: "cerrado" })).toBe(false);
  });
});

describe("puntuarIncidente", () => {
  it("fatal reciente en prod con muchas ocurrencias y usuarios → score alto", () => {
    const s = puntuarIncidente(inc({
      id: "1", firma: "f1", nivel: "fatal", entorno: "produccion",
      ocurrencias: 100, usuariosAfectados: 100, ultimaVez: HOY.toISOString(),
    }), HOY);
    // 40 + 25 + 20 + 15 + 10 = 110 → clamp 100
    expect(s).toBe(100);
  });
  it("warning viejo, poca frecuencia → score bajo", () => {
    const s = puntuarIncidente(inc({
      id: "2", firma: "f2", nivel: "warning", ocurrencias: 1, ultimaVez: "2026-01-01T00:00:00.000Z",
    }), HOY);
    // 10 + ~0.25 + 0 + 0 + 0 → 10
    expect(s).toBe(10);
  });
  it("nivel desconocido usa el default", () => {
    const s = puntuarIncidente(inc({ id: "3", firma: "f3", nivel: "raro", ocurrencias: 0, ultimaVez: null }), HOY);
    expect(s).toBe(15);
  });
});

describe("severidadDeScore", () => {
  it("mapea por umbrales", () => {
    expect(severidadDeScore(80)).toBe("critica");
    expect(severidadDeScore(50)).toBe("importante");
    expect(severidadDeScore(25)).toBe("oportunidad");
  });
});

describe("priorizarIncidentes", () => {
  it("descarta ruido, resueltos, ordena desc y deduplica por firma", () => {
    const out = priorizarIncidentes([
      inc({ id: "a", firma: "boom", nivel: "fatal", entorno: "prod", ocurrencias: 50, usuariosAfectados: 40 }), // alto
      inc({ id: "b", firma: "boom", nivel: "error", ocurrencias: 2 }),   // misma firma, menor → se descarta
      inc({ id: "c", firma: "warn", nivel: "warning", ocurrencias: 1, ultimaVez: "2026-01-01T00:00:00.000Z" }), // 10 < minScore → ruido
      inc({ id: "d", firma: "resuelto", nivel: "fatal", estado: "resuelto" }), // resuelto → fuera
      inc({ id: "e", firma: "medio", nivel: "error", ocurrencias: 20, usuariosAfectados: 10 }), // importante
    ], HOY);

    expect(out.map((x) => x.firma)).toEqual(["boom", "medio"]);
    expect(out[0]!.id).toBe("a");            // dedup se quedó con el de mayor score
    expect(out[0]!.severidad).toBe("critica");
    expect(out[0]!.motivo).toContain("en producción");
  });

  it("respeta el tope max", () => {
    const muchos = Array.from({ length: 5 }, (_, i) =>
      inc({ id: `i${i}`, firma: `f${i}`, nivel: "fatal", ocurrencias: 100 }));
    expect(priorizarIncidentes(muchos, HOY, { umbrales: { minScore: 20, critico: 70, importante: 40, max: 2 } })).toHaveLength(2);
  });
});
