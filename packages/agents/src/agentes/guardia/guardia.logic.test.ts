import { describe, it, expect } from "vitest";
import type { Incidente, TenantCtx } from "@agent-core/contracts";
import { agenteGuardia, evaluarGuardia, formatearDuracion } from "./index.js";

const AHORA = new Date("2026-10-30T12:00:00.000Z");
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString();
const inc = (over: Partial<Parameters<typeof evaluarGuardia>[0]> = {}) => ({ id: "i1", firma: "f1", titulo: "Pánico", nivel: "fatal", estado: "nuevo", primeraVez: hace(10), ...over });

describe("evaluarGuardia", () => {
  it("lo grave sin atender pasa a CRÍTICO al superar el plazo de su nivel (fatal 5 min, error 30)", () => {
    expect(evaluarGuardia(inc({ primeraVez: hace(4) }), AHORA)).toBeNull();                       // todavía en plazo
    expect(evaluarGuardia(inc({ primeraVez: hace(5) }), AHORA)).toMatchObject({ tipo: "sin_atender", severidad: "critica", minutos: 5 });
    expect(evaluarGuardia(inc({ nivel: "error", primeraVez: hace(29) }), AHORA)).toBeNull();
    expect(evaluarGuardia(inc({ nivel: "error", primeraVez: hace(31) }), AHORA)).toMatchObject({ severidad: "critica" });
  });

  it("un warning sin atender es importante (no crítico) y con plazo largo", () => {
    expect(evaluarGuardia(inc({ nivel: "warning", primeraVez: hace(200) }), AHORA)).toBeNull();
    expect(evaluarGuardia(inc({ nivel: "warning", primeraVez: hace(300) }), AHORA)).toMatchObject({ severidad: "importante" });
  });

  it("'abierto', sin estado y mayúsculas cuentan como sin atender", () => {
    for (const estado of ["abierto", "OPEN", "Nuevo", null, ""]) expect(evaluarGuardia(inc({ estado }), AHORA)?.tipo).toBe("sin_atender");
  });

  it("en atención: avisa solo si tarda demasiado en resolverse (importante)", () => {
    expect(evaluarGuardia(inc({ estado: "reconocido", primeraVez: hace(29) }), AHORA)).toBeNull();
    expect(evaluarGuardia(inc({ estado: "reconocido", primeraVez: hace(45) }), AHORA)).toMatchObject({ tipo: "atencion_lenta", severidad: "importante" });
  });

  it("resuelto, falsa alarma, sin fecha o fecha inválida: nada", () => {
    for (const estado of ["resuelto", "false_alarm", "ignorado"]) expect(evaluarGuardia(inc({ estado }), AHORA)).toBeNull();
    expect(evaluarGuardia(inc({ primeraVez: null }), AHORA)).toBeNull();
    expect(evaluarGuardia(inc({ primeraVez: "no es fecha" }), AHORA)).toBeNull();
  });

  it("nivel desconocido usa el plazo por defecto; el reloj adelantado no da minutos negativos", () => {
    expect(evaluarGuardia(inc({ nivel: "raro", primeraVez: hace(59) }), AHORA)).toBeNull();
    expect(evaluarGuardia(inc({ nivel: "raro", primeraVez: hace(61) }), AHORA)).toMatchObject({ severidad: "critica" });
    expect(evaluarGuardia(inc({ primeraVez: new Date(AHORA.getTime() + 60_000).toISOString() }), AHORA)).toBeNull();
  });

  it("formatearDuracion", () => {
    expect([formatearDuracion(7), formatearDuracion(60), formatearDuracion(125), formatearDuracion(1440), formatearDuracion(3000)]).toEqual(["7 min", "1 h", "2 h 5 min", "1 d", "2 d"]);
  });
});

describe("agente Guardia", () => {
  const ctx: TenantCtx = { tenantId: "t1", now: () => AHORA };
  const incidente = (over: Partial<Incidente>): Incidente => ({
    id: "alerta:1", tenantId: "t1", creadoEn: hace(10), firma: "alerta:1", titulo: "Pánico", nivel: "fatal", ocurrencias: 1,
    estado: "nuevo", primeraVez: hace(12), ...over,
  });
  const correr = (items: Incidente[]) => agenteGuardia.run({ ctx, providers: { incidents: { open: async () => ({ items }) } }, store: {} as never, config: {} });

  it("genera recomendaciones críticas con clave estable (sin los minutos) y sin datos personales", async () => {
    const a = await correr([incidente({})]);
    expect(a.recomendaciones).toHaveLength(1);
    expect(a.recomendaciones[0]).toMatchObject({
      agentId: "guardia", tipo: "incidente_sin_atender", severidad: "critica", titulo: "Pánico: sin atender hace 12 min",
      dedupKey: "guardia:sin_atender:alerta:1", refEntidad: { tipo: "incidente", id: "alerta:1" },
    });
    const b = await correr([incidente({ primeraVez: hace(40) })]);
    expect(b.recomendaciones[0]!.titulo).toBe("Pánico: sin atender hace 40 min");   // el texto cambia…
    expect(b.recomendaciones[0]!.dedupKey).toBe(a.recomendaciones[0]!.dedupKey);    // …la clave no
  });

  it("ignora lo que está en plazo o resuelto; sin la capacidad devuelve vacío con nota", async () => {
    expect((await correr([incidente({ primeraVez: hace(1) }), incidente({ id: "x", firma: "x", estado: "resuelto" })])).recomendaciones).toHaveLength(0);
    const sin = await agenteGuardia.run({ ctx, providers: {}, store: {} as never, config: {} });
    expect(sin.recomendaciones).toEqual([]);
    expect(sin.resumen).toContain("incidents");
  });
});
