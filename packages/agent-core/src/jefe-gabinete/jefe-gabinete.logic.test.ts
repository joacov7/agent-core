import { describe, it, expect } from "vitest";
import {
  analizar, deduplicar, detectarConflictos, priorizar, conteosPorSeveridad, textoPlantilla,
} from "./jefe-gabinete.logic";
import type { RecoJefe } from "./jefe-gabinete.logic";

// Helper para armar recomendaciones de prueba.
function rec(over: Partial<RecoJefe>): RecoJefe {
  return {
    id: 1, agent_id: "comercial", tipo: "precio", titulo: "T", descripcion: null,
    prioridad: 3, severidad: "oportunidad", impacto_estimado: null, valor_esperado: null,
    confianza: 80, estado: "proposed", entity_type: null, entity_id: null,
    action_tool: null, dedup_key: null, metadata: {}, agentes: ["comercial"],
    ...over,
  };
}

describe("conteosPorSeveridad", () => {
  it("cuenta por severidad", () => {
    const c = conteosPorSeveridad([
      rec({ id: 1, severidad: "critica" }), rec({ id: 2, severidad: "importante" }),
      rec({ id: 3, severidad: "oportunidad" }), rec({ id: 4, severidad: "importante" }),
    ]);
    expect(c).toEqual({ criticas: 1, importantes: 2, oportunidades: 1 });
  });
});

describe("priorizar", () => {
  it("ordena por prioridad asc, luego valor esperado desc", () => {
    const out = priorizar([
      rec({ id: 1, prioridad: 3, valor_esperado: 100 }),
      rec({ id: 2, prioridad: 1, valor_esperado: 50 }),
      rec({ id: 3, prioridad: 1, valor_esperado: 500 }),
    ]);
    expect(out.map(r => r.id)).toEqual([3, 2, 1]);
  });
});

describe("deduplicar", () => {
  it("colapsa misma entidad+tipo y une agentes", () => {
    const out = deduplicar([
      rec({ id: 1, entity_type: "producto", entity_id: "X", tipo: "precio", prioridad: 2, agentes: ["comercial"] }),
      rec({ id: 2, entity_type: "producto", entity_id: "X", tipo: "precio", prioridad: 1, agentes: ["inteligencia"] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(2); // mejor prioridad gana
    expect(out[0].agentes?.sort()).toEqual(["comercial", "inteligencia"]);
  });
  it("no colapsa entidades distintas", () => {
    const out = deduplicar([
      rec({ id: 1, entity_type: "producto", entity_id: "X", tipo: "precio" }),
      rec({ id: 2, entity_type: "producto", entity_id: "Y", tipo: "precio" }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("detectarConflictos", () => {
  it("Regla A: accionable con confianza < 60 → evidencia insuficiente", () => {
    const c = detectarConflictos([
      rec({ id: 1, action_tool: "aplicar_precio", confianza: 54, entity_type: "producto", entity_id: "X" }),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].tipo).toBe("evidencia_insuficiente");
    expect(c[0].recomendaciones).toEqual([1]);
  });
  it("no marca conflicto si la confianza es suficiente", () => {
    const c = detectarConflictos([
      rec({ id: 1, action_tool: "aplicar_precio", confianza: 85, entity_type: "producto", entity_id: "X" }),
    ]);
    expect(c).toHaveLength(0);
  });
  it("Regla B: bajar precio + señal de margen sobre la misma entidad → contradicción", () => {
    const c = detectarConflictos([
      rec({ id: 1, agent_id: "comercial", tipo: "precio", entity_type: "producto", entity_id: "X", metadata: { direccion: "baja" }, confianza: 85, action_tool: "aplicar_precio", agentes: ["comercial"] }),
      rec({ id: 2, agent_id: "finanzas", tipo: "margen_bajo", titulo: "Margen bajo", entity_type: "producto", entity_id: "X", confianza: 90, agentes: ["finanzas"] }),
    ]);
    const contradiccion = c.find(x => x.tipo === "contradiccion");
    expect(contradiccion).toBeTruthy();
    expect(contradiccion!.agentes.sort()).toEqual(["comercial", "finanzas"]);
  });
});

describe("analizar (orquestación)", () => {
  it("sin recomendaciones → resultado sin_datos", () => {
    const r = analizar([]);
    expect(r.resultado).toBe("sin_datos");
    expect(r.seleccionadas).toHaveLength(0);
    expect(r.textoPlantilla).toContain("Sin recomendaciones");
  });
  it("las recomendaciones en conflicto NO se seleccionan como prioridad", () => {
    const r = analizar([
      rec({ id: 1, action_tool: "aplicar_precio", confianza: 40, prioridad: 1, entity_type: "producto", entity_id: "X" }),
      rec({ id: 2, prioridad: 2, entity_type: "producto", entity_id: "Y", tipo: "stock", confianza: 90 }),
    ]);
    expect(r.conflictos.length).toBe(1);
    expect(r.seleccionadas.map(s => s.id)).toEqual([2]); // la #1 quedó fuera por conflicto
  });
  it("selecciona hasta 5", () => {
    const recs = Array.from({ length: 8 }, (_, i) => rec({ id: i + 1, prioridad: (i % 5) + 1, confianza: 90, entity_type: "producto", entity_id: `P${i}`, tipo: "stock" }));
    const r = analizar(recs);
    expect(r.seleccionadas.length).toBe(5);
  });
});

describe("textoPlantilla (fallback sin IA)", () => {
  it("arma texto con prioridades y conflictos, sin IA", () => {
    const t = textoPlantilla(
      { criticas: 1, importantes: 2, oportunidades: 0 },
      [rec({ id: 1, titulo: "Reponer yerba", valor_esperado: 240000, confianza: 90 })],
      [{ tipo: "contradiccion", entity: "producto:X", motivo: "señales contradictorias", recomendaciones: [2, 3], agentes: ["comercial", "finanzas"] }],
    );
    expect(t).toContain("Prioridad 1: Reponer yerba");
    expect(t).toContain("⚠️");
    expect(t).toContain("comercial");
  });
});
