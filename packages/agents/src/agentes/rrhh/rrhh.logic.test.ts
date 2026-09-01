import { describe, it, expect } from "vitest";
import { evaluarEmpleado, diasHasta, type EmpleadoInput } from "./rrhh.logic.js";

const HOY = new Date("2026-08-25T12:00:00.000Z");

function emp(p: Partial<EmpleadoInput> & Pick<EmpleadoInput, "id">): EmpleadoInput {
  return { nombre: "N", estado: "activo", finPeriodoPrueba: null, proximaRevision: null, ...p };
}

describe("diasHasta", () => {
  it("positivo a futuro, negativo si pasó", () => {
    expect(diasHasta("2026-08-30T12:00:00.000Z", HOY)).toBe(5);
    expect(diasHasta("2026-08-20T12:00:00.000Z", HOY)).toBe(-5);
  });
});

describe("evaluarEmpleado", () => {
  it("fin de prueba próximo → importante; vencido → crítica", () => {
    const prox = evaluarEmpleado(emp({ id: "e1", finPeriodoPrueba: "2026-09-05T00:00:00.000Z" }), HOY);
    expect(prox).toHaveLength(1);
    expect(prox[0]!.tipo).toBe("fin_periodo_prueba");
    expect(prox[0]!.severidad).toBe("importante");

    const venc = evaluarEmpleado(emp({ id: "e2", finPeriodoPrueba: "2026-08-10T00:00:00.000Z" }), HOY);
    expect(venc[0]!.severidad).toBe("critica");
  });

  it("revisión próxima → oportunidad; vencida → importante", () => {
    const prox = evaluarEmpleado(emp({ id: "e3", proximaRevision: "2026-09-05T00:00:00.000Z" }), HOY);
    expect(prox[0]!.tipo).toBe("revision_desempeno");
    expect(prox[0]!.severidad).toBe("oportunidad");

    const venc = evaluarEmpleado(emp({ id: "e4", proximaRevision: "2026-08-01T00:00:00.000Z" }), HOY);
    expect(venc[0]!.severidad).toBe("importante");
  });

  it("puede emitir dos alertas (prueba y revisión)", () => {
    const dos = evaluarEmpleado(emp({
      id: "e5", finPeriodoPrueba: "2026-09-01T00:00:00.000Z", proximaRevision: "2026-08-01T00:00:00.000Z",
    }), HOY);
    expect(dos.map((a) => a.tipo).sort()).toEqual(["fin_periodo_prueba", "revision_desempeno"]);
  });

  it("hitos lejanos → sin alerta", () => {
    expect(evaluarEmpleado(emp({ id: "e6", finPeriodoPrueba: "2026-12-01T00:00:00.000Z", proximaRevision: "2026-12-01T00:00:00.000Z" }), HOY)).toHaveLength(0);
  });

  it("ignora empleados dados de baja", () => {
    expect(evaluarEmpleado(emp({ id: "e7", estado: "baja", finPeriodoPrueba: "2026-08-10T00:00:00.000Z" }), HOY)).toHaveLength(0);
  });
});
