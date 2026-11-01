import { describe, it, expect } from "vitest";
import { catalogo } from "./catalogo.js";
import { leerCampos, schemaDeCampos, type CamposAjuste } from "./ajustes.js";
import { AJUSTES_COBROS, UMBRALES_COBROS_DEFAULT, clasificarCobro, umbralesCobrosDeConfig } from "./agentes/cobros/cobros.logic.js";
import { AJUSTES_MORA, UMBRALES_MORA_DEFAULT, clasificarMora, umbralesMoraDeConfig } from "./agentes/morosidad/morosidad.logic.js";
import { AJUSTES_PREVENTIVO, UMBRALES_PREVENTIVO_DEFAULT, clasificarPreventivo, umbralesPreventivoDeConfig } from "./agentes/cobranza-preventiva/cobranza-preventiva.logic.js";
import { AJUSTES_CHURN, UMBRALES_CHURN_DEFAULT, evaluarChurn, umbralesChurnDeConfig } from "./agentes/riesgo-abandono/churn.logic.js";
import { AJUSTES_GUARDIA, UMBRALES_GUARDIA_DEFAULT, evaluarGuardia, umbralesGuardiaDeConfig } from "./agentes/guardia/guardia.logic.js";

const CAMPOS: CamposAjuste = {
  dias: { titulo: "Días", descripcion: "d", default: 7, min: 0, max: 30, unidad: "días" },
  ratio: { titulo: "Ratio", descripcion: "r", default: 1.5, min: 0.5, max: 10, entero: false },
};

describe("ajustes (helper)", () => {
  it("el schema sale de la misma definición: tipo, rango, default, título y unidad", () => {
    const s = schemaDeCampos(CAMPOS) as { properties: Record<string, Record<string, unknown>>; additionalProperties: boolean };
    expect(s.additionalProperties).toBe(false);
    expect(s.properties.dias).toMatchObject({ type: "integer", title: "Días", default: 7, minimum: 0, maximum: 30, "x-unidad": "días" });
    expect(s.properties.ratio).toMatchObject({ type: "number", default: 1.5, minimum: 0.5, maximum: 10 });
    expect(s.properties.ratio).not.toHaveProperty("x-unidad");
  });

  it("lee lo configurado; lo inválido o fuera de rango cae al default (nunca rompe)", () => {
    expect(leerCampos(CAMPOS, { dias: 10, ratio: 2.5 })).toEqual({ dias: 10, ratio: 2.5 });
    expect(leerCampos(CAMPOS, undefined)).toEqual({ dias: 7, ratio: 1.5 });
    for (const malo of ["10", null, NaN, Infinity, -1, 31, {}, [], true]) {
      expect(leerCampos(CAMPOS, { dias: malo as never }).dias).toBe(7);
    }
    expect(leerCampos(CAMPOS, { ratio: 0.1 }).ratio).toBe(1.5);   // por debajo del mínimo
    expect(leerCampos(CAMPOS, { dias: 10.9 }).dias).toBe(10);      // los enteros se truncan
    expect(leerCampos(CAMPOS, { ratio: 2.25 }).ratio).toBe(2.25);  // los decimales se conservan
  });

  it("cae a la base de la línea antes que al default del campo, y la config propia pisa a la base", () => {
    expect(leerCampos(CAMPOS, {}, { dias: 20 }).dias).toBe(20);
    expect(leerCampos(CAMPOS, { dias: 3 }, { dias: 20 }).dias).toBe(3);
    expect(leerCampos(CAMPOS, { dias: 99 }, { dias: 20 }).dias).toBe(20); // la propia es inválida → base
  });
});

describe("cada agente configurable", () => {
  it("sus defaults del schema coinciden con los umbrales por defecto del código (no se desalinean)", () => {
    expect(umbralesCobrosDeConfig({})).toEqual(UMBRALES_COBROS_DEFAULT);
    expect(umbralesMoraDeConfig({})).toEqual(UMBRALES_MORA_DEFAULT);
    expect(umbralesPreventivoDeConfig({})).toEqual(UMBRALES_PREVENTIVO_DEFAULT);
    expect(umbralesChurnDeConfig({})).toEqual(UMBRALES_CHURN_DEFAULT);
    expect(umbralesGuardiaDeConfig({})).toEqual(UMBRALES_GUARDIA_DEFAULT);
  });

  it("Cobros: el umbral crítico y el monto mínimo cambian el resultado", () => {
    const cobro = { estado: "vencido", monto: 500, diasVencido: 15 };
    expect(clasificarCobro(cobro, umbralesCobrosDeConfig({}))?.severidad).toBe("importante");
    expect(clasificarCobro(cobro, umbralesCobrosDeConfig({ diasCritico: 10 }))?.severidad).toBe("critica");
    expect(clasificarCobro(cobro, umbralesCobrosDeConfig({ montoRelevante: 1000 }))).toBeNull();
    expect(AJUSTES_COBROS.montoRelevante.entero).toBe(false);
  });

  it("Morosidad: mueve los escalones y los mantiene ordenados aunque vengan cruzados", () => {
    expect(clasificarMora(20, umbralesMoraDeConfig({}))?.nivel).toBe("temprana");
    expect(clasificarMora(20, umbralesMoraDeConfig({ media: 15 }))?.nivel).toBe("media");
    expect(umbralesMoraDeConfig({ media: 50, avanzada: 20, incobrable: 10 })).toEqual({ media: 50, avanzada: 50, incobrable: 50 });
    expect(Object.keys(AJUSTES_MORA)).toEqual(["media", "avanzada", "incobrable"]);
  });

  it("Cobranza preventiva: la ventana de aviso nunca es menor que 'vence pronto'", () => {
    const c = { estado: "pendiente", monto: 100, diasHastaVencimiento: 12 };
    expect(clasificarPreventivo(c, umbralesPreventivoDeConfig({}))).toBeNull();
    expect(clasificarPreventivo(c, umbralesPreventivoDeConfig({ diasAviso: 15 }))).not.toBeNull();
    expect(umbralesPreventivoDeConfig({ diasProximo: 10, diasAviso: 2 }).diasAviso).toBe(10);
    expect(Object.keys(AJUSTES_PREVENTIVO)).toContain("montoRelevante");
  });

  it("Riesgo de abandono: subir 'en riesgo' reduce el ruido; los escalones quedan ordenados", () => {
    const cliente = { compras: 5, diasDesdeUltima: 35, frecuenciaDias: 30 };
    expect(evaluarChurn(cliente, umbralesChurnDeConfig({}))?.nivel).toBe("en_riesgo");
    expect(evaluarChurn(cliente, umbralesChurnDeConfig({ enRiesgo: 1.5 }))).toBeNull();
    const u = umbralesChurnDeConfig({ enRiesgo: 4, probable: 2, perdido: 1 });
    expect(u.enRiesgo <= u.probable && u.probable <= u.perdido).toBe(true);
    expect(Object.keys(AJUSTES_CHURN)).toContain("minCompras");
  });

  it("Guardia: el plazo por nivel se ajusta y el nivel desconocido conserva su umbral por defecto", () => {
    const AHORA = new Date("2026-10-30T12:00:00.000Z");
    const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString();
    const panico = { id: "i", firma: "f", titulo: "Pánico", nivel: "fatal", estado: "nuevo", primeraVez: hace(10) };
    expect(evaluarGuardia(panico, AHORA, umbralesGuardiaDeConfig({}))?.severidad).toBe("critica");
    expect(evaluarGuardia(panico, AHORA, umbralesGuardiaDeConfig({ sinAtenderFatalMin: 15 }))).toBeNull();
    expect(umbralesGuardiaDeConfig({ sinAtenderFatalMin: 15 }).defecto).toEqual(UMBRALES_GUARDIA_DEFAULT.defecto);
    expect(Object.keys(AJUSTES_GUARDIA)).toHaveLength(6);
  });
});

describe("catálogo: todo configSchema es consistente", () => {
  const conSchema = catalogo.filter((a) => a.manifest.configSchema);

  it("hay agentes configurables (los de cobro, la Guardia, la Agenda y el riesgo de abandono)", () => {
    expect(conSchema.map((a) => a.manifest.id).sort()).toEqual(
      ["agenda", "cobranza_preventiva", "cobros", "guardia", "morosidad", "riesgo_abandono"],
    );
  });

  it("cada propiedad es numérica, con título, rango válido y un default dentro del rango", () => {
    for (const a of conSchema) {
      const props = (a.manifest.configSchema as { properties: Record<string, Record<string, unknown>> }).properties;
      for (const [clave, p] of Object.entries(props)) {
        const donde = `${a.manifest.id}.${clave}`;
        expect(["integer", "number"], donde).toContain(p.type);
        expect(typeof p.title, donde).toBe("string");
        expect(typeof p.minimum, donde).toBe("number");
        expect(typeof p.maximum, donde).toBe("number");
        expect(p.default as number, donde).toBeGreaterThanOrEqual(p.minimum as number);
        expect(p.default as number, donde).toBeLessThanOrEqual(p.maximum as number);
      }
    }
  });
});
