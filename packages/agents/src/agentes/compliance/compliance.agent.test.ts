import { describe, it, expect } from "vitest";
import type { Documento, Evento, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteCompliance } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T12:00:00.000Z") };

function evento(p: Partial<Evento> & Pick<Evento, "id" | "tipo" | "titulo" | "inicia">): Evento {
  return { tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", ...p } as Evento;
}
function documento(refId: string): Documento {
  return { id: `doc-${refId}`, tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "escrito", titulo: "X", refEntidad: { tipo: "evento", id: refId } };
}

describe("agenteCompliance.run", () => {
  it("sin capacidades → vacío con nota", async () => {
    const out = await agenteCompliance.run({ ctx, providers: {}, store: {} as never, config: {} });
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/Faltan capacidades/);
  });

  it("escala obligación sin respaldo a crítica; ignora eventos que no son obligación", async () => {
    const providers: ProviderRegistry = {
      agenda: {
        async upcoming() {
          return {
            items: [
              evento({ id: "ev1", tipo: "vencimiento_afip", titulo: "DDJJ IVA", inicia: "2026-08-27T00:00:00.000Z" }), // en 2d, sin respaldo
              evento({ id: "ev2", tipo: "presentacion", titulo: "Escrito juzgado", inicia: "2026-08-28T00:00:00.000Z" }), // en 3d, con respaldo
              evento({ id: "ev3", tipo: "reunion_interna", titulo: "Daily", inicia: "2026-08-26T00:00:00.000Z" }), // no es obligación
            ],
          };
        },
      },
      documents: {
        async list() { return { items: [documento("ev2")] }; },
        async get() { return null; },
      },
    };

    const out = await agenteCompliance.run({ ctx, providers, store: {} as never, config: {} });
    const porId = new Map(out.recomendaciones.map((r) => [r.refEntidad!.id, r]));
    expect(out.recomendaciones).toHaveLength(2); // ev3 no es obligación
    expect(porId.get("ev1")!.severidad).toBe("critica");    // sin respaldo
    expect(porId.get("ev2")!.severidad).toBe("importante");  // con respaldo
    expect(porId.get("ev1")!.tipo).toBe("compliance");
  });
});
