import { describe, it, expect } from "vitest";
import type { Empleado, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteRrhh } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T12:00:00.000Z") };

function emp(p: Partial<Empleado> & Pick<Empleado, "id" | "nombre">): Empleado {
  return { tenantId: "t1", creadoEn: "2026-01-01T00:00:00.000Z", estado: "activo", ...p } as Empleado;
}

describe("agenteRrhh.run", () => {
  it("sin capacidad staff → vacío con nota", async () => {
    const out = await agenteRrhh.run({ ctx, providers: {}, store: {} as never, config: {} });
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/Falta la capacidad/);
  });

  it("emite hitos de prueba y revisión, ignora los lejanos y las bajas", async () => {
    const providers: ProviderRegistry = {
      staff: {
        async list() {
          return {
            items: [
              emp({ id: "e1", nombre: "Ana", rol: "Vendedora", finPeriodoPrueba: "2026-09-01T00:00:00.000Z" }), // importante
              emp({ id: "e2", nombre: "Beto", proximaRevision: "2026-08-01T00:00:00.000Z" }), // vencida → importante
              emp({ id: "e3", nombre: "Cami", finPeriodoPrueba: "2026-12-01T00:00:00.000Z" }), // lejano → nada
              emp({ id: "e4", nombre: "Dani", estado: "baja", finPeriodoPrueba: "2026-08-10T00:00:00.000Z" }), // baja → nada
            ],
          };
        },
      },
    };
    const out = await agenteRrhh.run({ ctx, providers, store: {} as never, config: {} });
    const porEmp = out.recomendaciones.map((r) => `${r.refEntidad!.id}:${r.tipo}`).sort();
    expect(porEmp).toEqual(["e1:fin_periodo_prueba", "e2:revision_desempeno"]);
  });
});
