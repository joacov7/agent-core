import { describe, it, expect } from "vitest";
import type { AgentContext, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteAgenda } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T00:00:00.000Z") };
function contexto(providers: ProviderRegistry): AgentContext {
  return { ctx, providers, store: {} as never, config: {} };
}

describe("agenteAgenda.run", () => {
  it("marca el evento próximo/vencido e ignora el lejano", async () => {
    const providers: ProviderRegistry = {
      agenda: {
        async upcoming() {
          return { items: [
            { id: "ev1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "vencimiento", titulo: "AFIP", inicia: "2026-08-20T00:00:00.000Z" },
            { id: "ev2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "turno", titulo: "Reunión", inicia: "2026-11-01T00:00:00.000Z" },
          ] };
        },
      },
    };
    const out = await agenteAgenda.run(contexto(providers));
    expect(out.recomendaciones).toHaveLength(1);
    expect(out.recomendaciones[0]!.tipo).toBe("vencimiento");
    expect(out.recomendaciones[0]!.severidad).toBe("critica"); // ya vencido
    expect(out.recomendaciones[0]!.refEntidad).toEqual({ tipo: "evento", id: "ev1" });
  });

  it("sin agenda → vacío", async () => {
    const out = await agenteAgenda.run(contexto({}));
    expect(out.recomendaciones).toHaveLength(0);
  });

  it("los umbrales son configurables: con aviso a 30 días un contrato en 20 días SÍ se avisa (y con el default, no)", async () => {
    const providers: ProviderRegistry = {
      agenda: {
        async upcoming() {
          return { items: [
            { id: "c1", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "vencimiento_contrato", titulo: "Contrato por vencer", inicia: "2026-09-14T00:00:00.000Z" }, // en 20 días
            { id: "c2", tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", tipo: "vencimiento_contrato", titulo: "Otro", inicia: "2026-08-30T00:00:00.000Z" },             // en 5 días
          ] };
        },
      },
    };
    const conDefault = await agenteAgenda.run(contexto(providers));
    expect(conDefault.recomendaciones.map((r) => r.refEntidad?.id)).toEqual(["c2"]);          // solo el de 5 días (aviso a 7)

    const configurado = await agenteAgenda.run({ ...contexto(providers), config: { diasProximo: 7, diasAviso: 30 } });
    const porId = Object.fromEntries(configurado.recomendaciones.map((r) => [r.refEntidad!.id, r.severidad]));
    expect(porId).toEqual({ c1: "oportunidad", c2: "importante" });                          // 20 d → aviso temprano; 5 d → importante
  });
});
