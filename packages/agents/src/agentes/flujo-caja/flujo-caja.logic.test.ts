import { describe, it, expect } from "vitest";
import { proyectarFlujo } from "./flujo-caja.logic";

const hoy = new Date("2026-08-25T00:00:00.000Z");

describe("proyectarFlujo", () => {
  it("agrupa ingresos y egresos por ventana temporal", () => {
    const p = proyectarFlujo(
      [
        { fecha: "2026-08-28T00:00:00.000Z", monto: 100 }, // 3d → 0-7
        { fecha: "2026-09-10T00:00:00.000Z", monto: 200 }, // 16d → 8-30
      ],
      [
        { fecha: "2026-09-12T00:00:00.000Z", monto: 50 },  // 18d → 8-30
      ],
      hoy,
    );
    const b07 = p.buckets.find((b) => b.rango === "0-7")!;
    const b830 = p.buckets.find((b) => b.rango === "8-30")!;
    expect(b07.ingresos).toBe(100);
    expect(b830.neto).toBe(150); // 200 - 50
    expect(p.ingresosTotal).toBe(300);
    expect(p.egresosTotal).toBe(50);
    expect(p.netoTotal).toBe(250);
  });

  it("un movimiento vencido cae en 0-7", () => {
    const p = proyectarFlujo([{ fecha: "2026-07-01T00:00:00.000Z", monto: 500 }], [], hoy);
    expect(p.buckets.find((b) => b.rango === "0-7")!.ingresos).toBe(500);
  });

  it("sin fecha → 60+", () => {
    const p = proyectarFlujo([], [{ monto: 90 }], hoy);
    expect(p.buckets.find((b) => b.rango === "60+")!.egresos).toBe(90);
    expect(p.netoTotal).toBe(-90);
  });
});
