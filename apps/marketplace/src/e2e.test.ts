import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import { runAgent, manifestsActivables, capacidadesDeProviders } from "@agent-core/core";
import { catalogo } from "@agent-core/agents";
import { crearApp } from "./app.js";

const ctx: TenantCtx = { tenantId: "vendedor1", requestId: "req-mkt", now: () => new Date("2026-09-14T12:00:00.000Z") };

describe("marketplace — reutilización del Core (cadencia transaccional_repetitivo, tenant por vendedor)", () => {
  it("activa el catálogo según las capacidades del vendedor + la cadencia", () => {
    const app = crearApp();
    const capacidades = capacidadesDeProviders(app.providers);
    expect(new Set(capacidades)).toEqual(new Set([
      "contacts", "transactions", "receivables", "catalog", "inventory", "pipeline", "competition", "feedback",
    ]));

    const activables = new Set(
      manifestsActivables(catalogo, { capacidades, modeloNegocio: app.modeloNegocio }).map((a) => a.manifest.id),
    );
    expect(activables).toEqual(new Set([
      "tareas", "whatsapp", "crm", "oportunidades", "rentabilidad", "cobros", "morosidad",
      "cobranza_preventiva", "flujo_caja", "inventario", "seguimiento", "riesgo_abandono",
      "competencia", "precios", "postventa", "ventas", "nps", "analista", "ceo", "jefe",
    ]));
    // OFF: agentes que piden capacidades que el vendedor no expone.
    for (const off of ["agenda", "compliance", "compras", "logistica", "produccion", "prospeccion", "rrhh", "sistemas"]) {
      expect(activables.has(off)).toBe(false);
    }
  });

  it("el MISMO catálogo produce las recomendaciones esperadas del marketplace", async () => {
    const app = crearApp();
    const activables = manifestsActivables(catalogo, {
      capacidades: capacidadesDeProviders(app.providers), modeloNegocio: app.modeloNegocio,
    });
    for (const agent of activables) {
      await runAgent({ agent, ctx, providers: app.providers, store: app.store, modeloNegocio: app.modeloNegocio });
    }

    const tipos = (await app.store.recommendations.list(ctx)).items.map((r) => r.tipo);
    expect(tipos).toEqual(expect.arrayContaining([
      "reactivacion",           // comprador valioso que se pasó de frecuencia (crm)
      "venta_cruzada",          // gorra para quien compró remera (oportunidades)
      "cobro_vencido",          // liquidación vencida (cobros)
      "cobro_por_vencer",       // liquidación por vencer (cobranza preventiva)
      "reponer",                // stock bajo (inventario)
      "competencia_por_encima", // otro vendedor más barato (competencia)
      "ajuste_precio",          // margen para bajar (precios)
      "seguimiento",            // carrito abandonado (seguimiento)
      "venta",                  // lead abierto (ventas)
      "reputacion_detractor",   // reseña negativa (nps)
    ]));
    // Nada de capacidades ausentes se coló:
    expect(tipos.some((t) => ["vencimiento", "comprar", "entrega", "proceso", "prospecto", "incidente"].includes(t))).toBe(false);
  });
});
