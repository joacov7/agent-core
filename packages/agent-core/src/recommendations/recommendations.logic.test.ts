import { describe, it, expect } from "vitest";
import {
  puedeTransicionar, calcularPrioridad, calcularValorEsperado, confianzaPorOrigen,
  dedupKey, severidadMax, ESTADOS_VIVOS,
} from "./recommendations.logic";

describe("máquina de estados", () => {
  it("permite transiciones válidas", () => {
    expect(puedeTransicionar("new", "proposed")).toBe(true);
    expect(puedeTransicionar("proposed", "pending_approval")).toBe(true);
    expect(puedeTransicionar("pending_approval", "approved")).toBe(true);
    expect(puedeTransicionar("approved", "executing")).toBe(true);
    expect(puedeTransicionar("executing", "executed")).toBe(true);
    expect(puedeTransicionar("pending_approval", "postponed")).toBe(true);
    expect(puedeTransicionar("failed", "pending_approval")).toBe(true); // reintento
  });

  it("rechaza transiciones inválidas", () => {
    expect(puedeTransicionar("executed", "pending_approval")).toBe(false); // terminal
    expect(puedeTransicionar("rejected", "approved")).toBe(false);
    expect(puedeTransicionar("new", "executed")).toBe(false); // no se saltea el flujo
    expect(puedeTransicionar("cancelled", "new")).toBe(false);
  });

  it("los estados vivos son los esperados", () => {
    expect(ESTADOS_VIVOS).toEqual(
      ["new", "analyzing", "proposed", "pending_approval", "postponed"]
    );
    // los terminales NO están vivos
    expect(ESTADOS_VIVOS).not.toContain("executed");
    expect(ESTADOS_VIVOS).not.toContain("rejected");
  });
});

describe("valor esperado", () => {
  it("calcula impacto × probabilidad × margen", () => {
    expect(calcularValorEsperado({ impacto: 1000, probabilidad: 0.5, margen: 0.4 })).toBe(200);
  });
  it("margen por defecto = 1 cuando no se pasa", () => {
    expect(calcularValorEsperado({ impacto: 1000, probabilidad: 0.5 })).toBe(500);
  });
  it("devuelve null (sin estimación) si falta impacto o probabilidad", () => {
    expect(calcularValorEsperado({ probabilidad: 0.5 })).toBeNull();
    expect(calcularValorEsperado({ impacto: 1000 })).toBeNull();
    expect(calcularValorEsperado({})).toBeNull();
  });
});

describe("confianza por origen", () => {
  it("determinístico y cálculo → alta", () => {
    expect(confianzaPorOrigen("deterministico")).toBe(95);
    expect(confianzaPorOrigen("calculo")).toBe(90);
  });
  it("inferencia según evidencia", () => {
    expect(confianzaPorOrigen("inferencia_alta")).toBe(80);
    expect(confianzaPorOrigen("inferencia_media")).toBe(60);
    expect(confianzaPorOrigen("inferencia_baja")).toBe(40);
  });
  it("IA e incompleto → menor", () => {
    expect(confianzaPorOrigen("ia")).toBe(55);
    expect(confianzaPorOrigen("incompleto")).toBe(30);
  });
});

describe("prioridad", () => {
  it("crítica confiable y con valor esperado es la más alta (1)", () => {
    expect(calcularPrioridad({ severidad: "critica", confianza: 95, valorEsperado: 5000 })).toBe(1);
  });
  it("sin estimación económica baja la prioridad", () => {
    const conValor = calcularPrioridad({ severidad: "importante", confianza: 90, valorEsperado: 1000 });
    const sinValor = calcularPrioridad({ severidad: "importante", confianza: 90, valorEsperado: null });
    expect(sinValor).toBeGreaterThan(conValor);
  });
  it("poca confianza baja la prioridad", () => {
    const alta = calcularPrioridad({ severidad: "oportunidad", confianza: 90, valorEsperado: 100 });
    const baja = calcularPrioridad({ severidad: "oportunidad", confianza: 20, valorEsperado: 100 });
    expect(baja).toBeGreaterThan(alta);
  });
  it("siempre queda en el rango 1..5", () => {
    for (const sev of ["critica", "importante", "oportunidad"] as const) {
      const p = calcularPrioridad({ severidad: sev, confianza: 0, valorEsperado: null });
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(5);
    }
  });
});

describe("dedupKey", () => {
  it("usa tipo + entidad cuando hay entidad", () => {
    expect(dedupKey({ tipo: "precio_alto", entityType: "producto", entityId: "42" }))
      .toBe("precio_alto:producto:42");
  });
  it("misma entidad + mismo tipo → misma clave (deduplica)", () => {
    const a = dedupKey({ tipo: "precio_alto", entityType: "producto", entityId: "42" });
    const b = dedupKey({ tipo: "precio_alto", entityType: "producto", entityId: "42" });
    expect(a).toBe(b);
  });
  it("distinto producto → distinta clave (no fusiona)", () => {
    const a = dedupKey({ tipo: "precio_alto", entityType: "producto", entityId: "42" });
    const b = dedupKey({ tipo: "precio_alto", entityType: "producto", entityId: "99" });
    expect(a).not.toBe(b);
  });
  it("sin entidad y sin extra → null (no deduplica)", () => {
    expect(dedupKey({ tipo: "precio_alto" })).toBeNull();
  });
  it("sin entidad pero con extra → clave por extra (para el shim)", () => {
    expect(dedupKey({ tipo: "comercial", extra: "reponer-yerba" }))
      .toBe("comercial:reponer-yerba");
  });
});

describe("severidadMax", () => {
  it("toma la más severa de las fuentes", () => {
    expect(severidadMax("oportunidad", "critica")).toBe("critica");
    expect(severidadMax("importante", "oportunidad")).toBe("importante");
    expect(severidadMax("critica", "importante")).toBe("critica");
  });
});
