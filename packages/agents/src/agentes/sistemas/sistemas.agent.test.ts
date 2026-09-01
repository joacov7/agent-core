import { describe, it, expect } from "vitest";
import type { Incidente, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteSistemas } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T12:00:00.000Z") };

function inc(p: Partial<Incidente> & Pick<Incidente, "id" | "firma" | "titulo" | "ocurrencias">): Incidente {
  return { tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", estado: "abierto", ...p } as Incidente;
}

describe("agenteSistemas.run", () => {
  it("sin capacidad incidents → vacío con nota", async () => {
    const out = await agenteSistemas.run({ ctx, providers: {}, store: {} as never, config: {} });
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/Falta la capacidad/);
  });

  it("prioriza incidentes abiertos y descarta ruido/resueltos", async () => {
    const providers: ProviderRegistry = {
      incidents: {
        async open() {
          return {
            items: [
              inc({ id: "i1", firma: "npe", titulo: "NullPointer en checkout", servicio: "checkout", nivel: "fatal", entorno: "produccion", ocurrencias: 80, usuariosAfectados: 60, ultimaVez: "2026-08-25T00:00:00.000Z" }),
              inc({ id: "i2", firma: "warn-viejo", titulo: "Deprecation", nivel: "warning", ocurrencias: 1, ultimaVez: "2026-01-01T00:00:00.000Z" }), // ruido
              inc({ id: "i3", firma: "fixed", titulo: "Ya resuelto", nivel: "fatal", ocurrencias: 50, estado: "resuelto" }), // fuera
            ],
          };
        },
      },
    };
    const out = await agenteSistemas.run({ ctx, providers, store: {} as never, config: {} });
    expect(out.recomendaciones).toHaveLength(1);
    const r = out.recomendaciones[0]!;
    expect(r.tipo).toBe("incidente");
    expect(r.severidad).toBe("critica");
    expect(r.titulo).toBe("[checkout] NullPointer en checkout");
    expect(r.refEntidad).toEqual({ tipo: "incidente", id: "i1" });
  });
});
