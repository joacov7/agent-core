import { describe, it, expect } from "vitest";
import {
  confianzaProspecto, detectarProspectos, PESOS_FUENTE_DEFAULT,
  type SenalProspecto,
} from "./prospeccion.logic.js";

function senal(p: Partial<SenalProspecto> & Pick<SenalProspecto, "id">): SenalProspecto {
  return { fuente: "web", nombre: "N", clave: null, motivo: null, score: null, ...p };
}

describe("confianzaProspecto", () => {
  it("usa el peso de la fuente cuando no hay score", () => {
    expect(confianzaProspecto({ fuente: "referido", score: null })).toBe(PESOS_FUENTE_DEFAULT.referido);
    expect(confianzaProspecto({ fuente: "web", score: null })).toBe(PESOS_FUENTE_DEFAULT.web);
  });
  it("fuente desconocida cae al peso neutro 50", () => {
    expect(confianzaProspecto({ fuente: "otra_cosa", score: null })).toBe(50);
  });
  it("mezcla 50/50 el score con el peso de la fuente", () => {
    // referido (80) + score 100 → 90
    expect(confianzaProspecto({ fuente: "referido", score: 100 })).toBe(90);
    // web (45) + score 55 → 50
    expect(confianzaProspecto({ fuente: "web", score: 55 })).toBe(50);
  });
  it("es case-insensitive con la fuente", () => {
    expect(confianzaProspecto({ fuente: "REFERIDO", score: null })).toBe(80);
  });
});

describe("detectarProspectos", () => {
  it("descarta señales cuya clave ya está en la base", () => {
    const senales = [
      senal({ id: "a", fuente: "referido", nombre: "Ya cliente", clave: "cli@x.com" }),
      senal({ id: "b", fuente: "referido", nombre: "Nuevo", clave: "nuevo@x.com" }),
    ];
    const out = detectarProspectos(senales, ["CLI@x.com"]); // match case-insensitive
    expect(out.map((p) => p.id)).toEqual(["b"]);
  });

  it("deduplica por clave quedándose con la de mayor confianza", () => {
    const senales = [
      senal({ id: "1", fuente: "web", nombre: "Dup", clave: "dup@x.com" }),        // 45 < min → fuera igual
      senal({ id: "2", fuente: "referido", nombre: "Dup", clave: "dup@x.com" }),   // 80
    ];
    const out = detectarProspectos(senales, []);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("2");
    expect(out[0]!.confianza).toBe(80);
  });

  it("filtra por confianza mínima (default 50) y ordena desc", () => {
    const senales = [
      senal({ id: "low", fuente: "web" }),                        // 45 → fuera
      senal({ id: "mid", fuente: "marketplace" }),                // 55
      senal({ id: "high", fuente: "referido" }),                  // 80
    ];
    const out = detectarProspectos(senales, []);
    expect(out.map((p) => p.id)).toEqual(["high", "mid"]);
  });

  it("respeta el tope max", () => {
    const senales = Array.from({ length: 5 }, (_, i) =>
      senal({ id: `r${i}`, fuente: "referido", clave: `r${i}@x.com` }));
    const out = detectarProspectos(senales, [], { max: 2 });
    expect(out).toHaveLength(2);
  });

  it("señales sin clave se deduplican por id y no chocan entre sí", () => {
    const senales = [
      senal({ id: "x", fuente: "referido", nombre: "A", clave: null }),
      senal({ id: "y", fuente: "referido", nombre: "B", clave: null }),
    ];
    const out = detectarProspectos(senales, []);
    expect(out.map((p) => p.id).sort()).toEqual(["x", "y"]);
  });
});
