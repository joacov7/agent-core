import { describe, it, expect } from "vitest";
import type {
  AgentContext, Contacto, ProviderRegistry, SenalExterna, TenantCtx,
} from "@agent-core/contracts";
import { agenteProspeccion } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

function señal(p: Partial<SenalExterna> & Pick<SenalExterna, "id">): SenalExterna {
  return { fuente: "web", nombre: "N", observadoEn: "2026-08-27T00:00:00.000Z", ...p };
}
function contacto(p: Partial<Contacto> & Pick<Contacto, "id" | "nombre">): Contacto {
  return { ...p } as Contacto;
}

describe("agenteProspeccion.run", () => {
  it("sin capacidades → vacío con nota", async () => {
    const out = await agenteProspeccion.run(contexto({}));
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/Faltan capacidades/);
  });

  it("prioriza prospectos y descarta los que ya están en la base", async () => {
    const providers: ProviderRegistry = {
      contacts: {
        async list() {
          return { items: [contacto({ id: "c1", nombre: "Cliente", emails: ["cli@x.com"] })] };
        },
        async get() { return null; },
        async history() { return { items: [] }; },
      },
      externalSources: {
        async prospects() {
          return {
            items: [
              señal({ id: "ya", fuente: "referido", nombre: "Ya cliente", clave: "cli@x.com" }),
              señal({ id: "nuevo", fuente: "referido", nombre: "Nuevo", clave: "nuevo@x.com", motivo: "pidió cotización" }),
              señal({ id: "flojo", fuente: "web", nombre: "Flojo", clave: "flojo@x.com" }), // 45 < min 50 → fuera
            ],
          };
        },
      },
    };

    const out = await agenteProspeccion.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    const r = out.recomendaciones[0]!;
    expect(r.tipo).toBe("prospecto");
    expect(r.titulo).toContain("Nuevo");
    expect(r.confianza).toBe(80);
    expect(r.refEntidad).toEqual({ tipo: "senal_externa", id: "nuevo" });
    expect(r.descripcion).toBe("pidió cotización");
  });
});
