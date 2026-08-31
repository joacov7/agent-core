import { describe, it, expect } from "vitest";
import type { Cobro, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { agenteCobranzaPreventiva } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-08-25T12:00:00.000Z") };

function cobro(p: Partial<Cobro> & Pick<Cobro, "id" | "monto" | "estado">): Cobro {
  return { tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", contactoId: "c1", ...p } as Cobro;
}

describe("agenteCobranzaPreventiva.run", () => {
  it("sin capacidad receivables → vacío", async () => {
    const out = await agenteCobranzaPreventiva.run({ ctx, providers: {}, store: {} as never, config: {} });
    expect(out.recomendaciones).toHaveLength(0);
  });

  it("avisa solo los cobros por vencer dentro de la ventana", async () => {
    const providers: ProviderRegistry = {
      receivables: {
        async pending() {
          return {
            items: [
              cobro({ id: "porVencer", monto: 10_000, estado: "pendiente", venceEn: "2026-08-27T12:00:00.000Z" }), // en 2 días → importante
              cobro({ id: "lejano", monto: 10_000, estado: "pendiente", venceEn: "2026-10-01T12:00:00.000Z" }),    // muy lejos → fuera
              cobro({ id: "vencido", monto: 10_000, estado: "vencido", venceEn: "2026-08-20T12:00:00.000Z" }),     // ya vencido → fuera
            ],
          };
        },
        async overdue() { return { items: [] }; },
      },
    };
    const out = await agenteCobranzaPreventiva.run({ ctx, providers, store: {} as never, config: {} });
    expect(out.recomendaciones).toHaveLength(1);
    const r = out.recomendaciones[0]!;
    expect(r.tipo).toBe("cobro_por_vencer");
    expect(r.severidad).toBe("importante");
    expect(r.refEntidad).toEqual({ tipo: "cobro", id: "porVencer" });
  });
});
