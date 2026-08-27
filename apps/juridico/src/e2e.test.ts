import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import { runAgent, manifestsActivables, capacidadesDeProviders } from "@agent-core/core";
import { catalogo } from "@agent-core/agents";
import { crearApp } from "./app.js";

const ctx: TenantCtx = { tenantId: "estudio", requestId: "req-jur", now: () => new Date("2026-08-25T12:00:00.000Z") };

describe("estudio jurídico — reutilización del Core (cadencia proyecto)", () => {
  it("activa solo los agentes compatibles con las capacidades + la cadencia proyecto", () => {
    const app = crearApp();
    const capacidades = capacidadesDeProviders(app.providers);
    expect(new Set(capacidades)).toEqual(new Set(["contacts", "receivables", "agenda", "documents", "pipeline"]));

    const activables = new Set(
      manifestsActivables(catalogo, { capacidades, modeloNegocio: app.modeloNegocio }).map((a) => a.manifest.id),
    );
    // ON (doc sección 10): cobros, morosidad, agenda, seguimiento, whatsapp + genéricos.
    expect(activables).toEqual(new Set([
      "tareas", "whatsapp", "cobros", "morosidad", "flujo_caja", "agenda", "seguimiento", "ventas", "ceo", "jefe",
    ]));
    // OFF: los que asumen retail / compra repetida o capacidades que el estudio no tiene.
    for (const off of ["crm", "oportunidades", "rentabilidad", "precios", "competencia", "inventario", "compras", "logistica", "produccion", "riesgo_abandono", "postventa", "analista"]) {
      expect(activables.has(off)).toBe(false);
    }
  });

  it("el MISMO catálogo produce las recomendaciones esperadas para el estudio", async () => {
    const app = crearApp();
    const activables = manifestsActivables(catalogo, {
      capacidades: capacidadesDeProviders(app.providers), modeloNegocio: app.modeloNegocio,
    });
    for (const agent of activables) {
      await runAgent({ agent, ctx, providers: app.providers, store: app.store, modeloNegocio: app.modeloNegocio });
    }

    const tipos = (await app.store.recommendations.list(ctx)).items.map((r) => r.tipo);
    expect(tipos).toEqual(expect.arrayContaining([
      "cobro_vencido",     // honorario vencido
      "mora_avanzada",     // honorario en mora avanzada
      "vencimiento",       // audiencia/plazo vencido
      "seguimiento",       // consulta sin cerrar
      "venta",             // consulta como oportunidad
      "atencion_consulta", // whatsapp entrante
    ]));
    // Nada de retail se coló:
    expect(tipos.some((t) => t.startsWith("churn") || t === "ajuste_precio" || t === "reponer")).toBe(false);
  });
});
