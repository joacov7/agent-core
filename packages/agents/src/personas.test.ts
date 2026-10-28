import { describe, it, expect } from "vitest";
import { catalogo } from "./catalogo.js";
import { personas, personaDe } from "./personas.js";

describe("personas del catálogo", () => {
  it("todo agente del catálogo tiene persona (y no sobran)", () => {
    const ids = catalogo.map((a) => a.manifest.id).sort();
    expect(Object.keys(personas).sort()).toEqual(ids);
  });

  it("los nombres son únicos y los saludos no están vacíos", () => {
    const nombres = Object.values(personas).map((p) => p.nombre.toLowerCase());
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(Object.values(personas).every((p) => p.saludo.length > 10)).toBe(true);
  });

  it("personaDe cae al id si el agente no tiene persona", () => {
    expect(personaDe("cobros").nombre).toBe("Lou");
    expect(personaDe("inexistente").nombre).toBe("inexistente");
  });
});
