import { describe, it, expect } from "vitest";
import { clasificarEvento, diasHasta, umbralesDeConfig, UMBRALES_AGENDA_DEFAULT } from "./agenda.logic";

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

describe("umbralesDeConfig", () => {
  it("sin config o con config vacía: los defaults", () => {
    expect(umbralesDeConfig(undefined)).toEqual(UMBRALES_AGENDA_DEFAULT);
    expect(umbralesDeConfig({})).toEqual(UMBRALES_AGENDA_DEFAULT);
  });
  it("toma valores válidos (enteros 0..365) y trunca decimales", () => {
    expect(umbralesDeConfig({ diasProximo: 15, diasAviso: 30 })).toEqual({ diasProximo: 15, diasAviso: 30 });
    expect(umbralesDeConfig({ diasProximo: 3.9 })).toEqual({ diasProximo: 3, diasAviso: 7 });
    expect(umbralesDeConfig({ diasProximo: 0, diasAviso: 0 })).toEqual({ diasProximo: 0, diasAviso: 0 });
  });
  it("ignora lo inválido (texto, negativo, absurdo, NaN) y queda el default", () => {
    expect(umbralesDeConfig({ diasProximo: "mucho", diasAviso: -5 })).toEqual(UMBRALES_AGENDA_DEFAULT);
    expect(umbralesDeConfig({ diasProximo: 9999, diasAviso: Number.NaN })).toEqual(UMBRALES_AGENDA_DEFAULT);
    expect(umbralesDeConfig({ diasProximo: null, diasAviso: {} })).toEqual(UMBRALES_AGENDA_DEFAULT);
  });
  it("el aviso temprano nunca es menor que el importante", () => {
    expect(umbralesDeConfig({ diasProximo: 20, diasAviso: 5 })).toEqual({ diasProximo: 20, diasAviso: 20 });
  });
});
