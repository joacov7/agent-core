import { describe, it, expect } from "vitest";
import type { ProviderRegistry, RespuestaFeedback, TenantCtx } from "@agent-core/contracts";
import { agenteNps } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };

function fb(p: Partial<RespuestaFeedback> & Pick<RespuestaFeedback, "id" | "puntaje">): RespuestaFeedback {
  return { tenantId: "t1", creadoEn: "2026-08-01T00:00:00.000Z", respondidoEn: "2026-08-20T00:00:00.000Z", ...p } as RespuestaFeedback;
}

describe("agenteNps.run", () => {
  it("sin capacidad feedback → vacío con nota", async () => {
    const out = await agenteNps.run({ ctx, providers: {}, store: {} as never, config: {} });
    expect(out.recomendaciones).toHaveLength(0);
    expect(out.resumen).toMatch(/Falta la capacidad/);
  });

  it("calcula el NPS y abre seguimiento por cada detractor", async () => {
    const providers: ProviderRegistry = {
      feedback: {
        async responses() {
          return {
            items: [
              fb({ id: "f1", puntaje: 10, contactoId: "c1" }),
              fb({ id: "f2", puntaje: 8, contactoId: "c2" }),
              fb({ id: "f3", puntaje: 4, contactoId: "c3", comentario: "demora en la entrega" }),
            ],
          };
        },
      },
    };
    const out = await agenteNps.run({ ctx, providers, store: {} as never, config: {} });
    // 1 prom, 1 pas, 1 det → (33 - 33) = 0
    expect(out.resumen).toContain("NPS 0");
    expect(out.recomendaciones).toHaveLength(1);
    const r = out.recomendaciones[0]!;
    expect(r.tipo).toBe("reputacion_detractor");
    expect(r.refEntidad).toEqual({ tipo: "contacto", id: "c3" });
    expect(r.descripcion).toBe("demora en la entrega");
  });
});
