import { describe, it, expect } from "vitest";
import { ajustesDe, camposDeSchema, validarConfig } from "./ajustes";

const SCHEMA = {
  type: "object",
  properties: {
    dias: { type: "integer", title: "Días de aviso", description: "Cuántos días antes.", minimum: 0, maximum: 30, default: 7, "x-unidad": "días" },
    ratio: { type: "number", minimum: 0.5, maximum: 10, default: 1.5 },
    activo: { type: "boolean", default: true },
    modo: { type: "string", enum: ["suave", "duro"], default: "suave" },
    nota: { type: "string", maxLength: 5, default: "" },
    raro: { type: "array" }, // un tipo que la consola no sabe dibujar
  },
};

describe("camposDeSchema", () => {
  it("convierte el schema en campos dibujables, con título, unidad y límites", () => {
    const campos = camposDeSchema(SCHEMA);
    expect(campos.map((c) => c.clave)).toEqual(["dias", "ratio", "activo", "modo", "nota"]); // 'raro' se omite
    expect(campos[0]).toEqual({ clave: "dias", tipo: "integer", titulo: "Días de aviso", descripcion: "Cuántos días antes.", unidad: "días", min: 0, max: 30 });
    expect(campos[1]!.titulo).toBe("ratio");                       // sin title → la clave
    expect(campos[3]!.opciones).toEqual(["suave", "duro"]);
    expect(campos[4]!.maxLength).toBe(5);
  });
  it("sin schema o sin propiedades → vacío", () => {
    expect(camposDeSchema(undefined)).toEqual([]);
    expect(camposDeSchema({})).toEqual([]);
    expect(camposDeSchema({ properties: [] as never })).toEqual([]);
  });
});

describe("validarConfig", () => {
  const v = (c: unknown) => validarConfig(SCHEMA, c, "Agenda");
  it("acepta valores válidos y conserva solo lo enviado", () => {
    expect(v({ dias: 10, ratio: 2.5, activo: false, modo: "duro", nota: "hola" })).toEqual({ ok: true, valor: { dias: 10, ratio: 2.5, activo: false, modo: "duro", nota: "hola" } });
    expect(v({})).toEqual({ ok: true, valor: {} });
  });
  it.each([
    [{ dias: 31 }, /"Días de aviso" no puede ser mayor que 30/],
    [{ dias: -1 }, /no puede ser menor que 0/],
    [{ dias: 1.5 }, /número entero/],
    [{ dias: "7" }, /tiene que ser un número/],
    [{ dias: NaN }, /tiene que ser un número/],
    [{ dias: null }, /tiene que ser un número/],
    [{ ratio: 0.1 }, /no puede ser menor que 0.5/],
    [{ activo: "si" }, /sí o no/],
    [{ modo: "otro" }, /una de: suave, duro/],
    [{ nota: "demasiado largo" }, /no puede superar 5 caracteres/],
    [{ inventado: 1 }, /no tiene el ajuste "inventado"/],
    [{ raro: [] }, /no tiene el ajuste "raro"/],
    [[], /tienen que ser un objeto/],
    ["x", /tienen que ser un objeto/],
    [null, /tienen que ser un objeto/],
  ])("rechaza %j", (cfg, mensaje) => {
    const r = v(cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(mensaje);
  });
  it("un agente sin ajustes rechaza cualquier clave, pero acepta {}", () => {
    expect(validarConfig(undefined, { a: 1 }, "Tareas")).toEqual({ ok: false, error: "Tareas no tiene ajustes configurables." });
    expect(validarConfig(undefined, {}, "Tareas")).toEqual({ ok: true, valor: {} });
  });
  it("las claves peligrosas no entran (solo se aceptan las del schema)", () => {
    expect(v(JSON.parse('{"__proto__": {"x": 1}}')).ok).toBe(false);
    expect(v({ constructor: 1 }).ok).toBe(false);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe("ajustesDe", () => {
  it("sin schema → undefined", () => expect(ajustesDe(undefined, {}, {})).toBeUndefined());

  it("propia gana a la línea y esta al default del agente; informa qué es propio", () => {
    const a = ajustesDe(SCHEMA, { dias: 3 }, { dias: 20, ratio: 4 })!;
    expect(a.valores).toMatchObject({ dias: 3, ratio: 4, activo: true, modo: "suave" });
    expect(a.porDefecto).toMatchObject({ dias: 20, ratio: 4, activo: true });
    expect(a.personalizados).toEqual(["dias"]);
  });
  it("un valor guardado inválido (config vieja o editada a mano) se ignora: no rompe la vista", () => {
    const a = ajustesDe(SCHEMA, { dias: 999, ratio: "x", modo: "otro" }, undefined)!;
    expect(a.valores).toMatchObject({ dias: 7, ratio: 1.5, modo: "suave" });
    expect(a.personalizados).toEqual([]);
  });
  it("un valor de la línea inválido cae al default del agente", () => {
    expect(ajustesDe(SCHEMA, undefined, { dias: -5 })!.porDefecto.dias).toBe(7);
  });
});
