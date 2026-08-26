import { describe, it, expect } from "vitest";
import { clasificarRentabilidad, UMBRALES_DEFAULT } from "./rentabilidad.logic";
import type { RentabilidadItem } from "./rentabilidad.logic";

function item(o: Partial<RentabilidadItem>): RentabilidadItem {
  return { id: "P", nombre: "Mate", precio: 1000, costo: 600, margen_pct: 40, ventas_30d: 3, stock: 10, valor_inmovilizado: 6000, ...o };
}

describe("clasificarRentabilidad", () => {
  it("margen bajo + alta rotación → importante", () => {
    const a = clasificarRentabilidad(item({ margen_pct: 11, ventas_30d: 20 }));
    expect(a?.tipo).toBe("margen_bajo");
    expect(a?.severidad).toBe("importante");
    expect(a?.descripcion).toContain("Vende bien");
  });
  it("margen bajo + baja rotación → oportunidad", () => {
    const a = clasificarRentabilidad(item({ margen_pct: 15, ventas_30d: 1 }));
    expect(a?.tipo).toBe("margen_bajo");
    expect(a?.severidad).toBe("oportunidad");
  });
  it("sin costo (margen desconocido) → no alerta de margen (no inventa)", () => {
    const a = clasificarRentabilidad(item({ costo: null, margen_pct: null, ventas_30d: 0, valor_inmovilizado: null }));
    expect(a).toBeNull();
  });
  it("inmovilizado: sin ventas + capital alto → importante con impacto real", () => {
    const a = clasificarRentabilidad(item({ margen_pct: 40, ventas_30d: 0, stock: 50, valor_inmovilizado: 500000 }));
    expect(a?.tipo).toBe("inmovilizado");
    expect(a?.severidad).toBe("importante");
    expect(a?.impactoEstimado).toBe(500000);
  });
  it("alto margen sin explotar → oportunidad", () => {
    const a = clasificarRentabilidad(item({ margen_pct: 45, ventas_30d: 1, valor_inmovilizado: 6000 }));
    expect(a?.tipo).toBe("oportunidad_margen");
    expect(a?.severidad).toBe("oportunidad");
    expect(a?.impactoEstimado).toBeNull();
  });
  it("producto sano (buen margen, buena rotación) → sin alerta", () => {
    const a = clasificarRentabilidad(item({ margen_pct: 40, ventas_30d: 20, valor_inmovilizado: 6000 }));
    expect(a).toBeNull();
  });
  it("prioridad: margen_bajo gana sobre inmovilizado", () => {
    const a = clasificarRentabilidad(item({ margen_pct: 10, ventas_30d: 0, valor_inmovilizado: 500000 }));
    expect(a?.tipo).toBe("margen_bajo");
  });
});
