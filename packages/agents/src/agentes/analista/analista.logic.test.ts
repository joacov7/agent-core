import { describe, it, expect } from "vitest";
import { calcularKpis, detectarAnomalias } from "./analista.logic";

const clientes = [
  { contactoId: "a", compras: 4, totalGastado: 400, ticketPromedio: 100 },
  { contactoId: "b", compras: 6, totalGastado: 600, ticketPromedio: 100 },
];

describe("calcularKpis", () => {
  it("agrega clientes, compras, ingreso y ticket global", () => {
    expect(calcularKpis(clientes)).toEqual({
      clientes: 2, comprasTotales: 10, ingresoTotal: 1000, ticketPromedioGlobal: 100,
    });
  });
});

describe("detectarAnomalias", () => {
  it("marca el ticket muy por encima del promedio", () => {
    const anom = detectarAnomalias([
      ...clientes,
      { contactoId: "vip", compras: 1, totalGastado: 400, ticketPromedio: 400 },
    ]);
    expect(anom.map((a) => a.contactoId)).toContain("vip");
  });
  it("sin outliers → vacío", () => {
    expect(detectarAnomalias(clientes)).toHaveLength(0);
  });
});
