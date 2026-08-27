import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import {
  runAgent, manifestsActivables, capacidadesDeProviders,
  evaluarEscritura, ejecutarAccion, registrarImpacto, registrarDecision,
} from "@agent-core/core";
import { catalogo } from "@agent-core/agents";
import { crearApp } from "./app.js";

const ctx: TenantCtx = { tenantId: "demo", requestId: "req-e2e", now: () => new Date("2026-08-25T12:00:00.000Z") };

describe("smoke end-to-end (adapter de referencia)", () => {
  it("activa el catálogo según capacidades + cadencia", () => {
    const app = crearApp();
    const capacidades = capacidadesDeProviders(app.providers);
    expect(new Set(capacidades)).toEqual(new Set([
      "contacts", "transactions", "catalog", "receivables", "agenda", "inventory", "suppliers", "pipeline",
      "competition", "logistics", "production", "external-sources",
    ]));

    const activables = manifestsActivables(catalogo, { capacidades, modeloNegocio: app.modeloNegocio })
      .map((a) => a.manifest.id);
    expect(new Set(activables)).toEqual(new Set([
      "tareas", "whatsapp", "crm", "oportunidades", "rentabilidad", "cobros", "agenda", "inventario",
      "morosidad", "flujo_caja", "seguimiento", "riesgo_abandono", "competencia", "precios",
      "compras", "logistica", "produccion", "postventa", "ventas", "prospeccion",
      "analista", "ceo", "jefe",
    ]));
  });

  it("corre los agentes y persiste sus recomendaciones (paso Recomendación)", async () => {
    const app = crearApp();
    const activables = manifestsActivables(catalogo, {
      capacidades: capacidadesDeProviders(app.providers), modeloNegocio: app.modeloNegocio,
    });

    for (const agent of activables) {
      await runAgent({ agent, ctx, providers: app.providers, store: app.store, modeloNegocio: app.modeloNegocio });
    }

    const { items } = await app.store.recommendations.list(ctx);
    const tipos = items.map((r) => r.tipo);
    expect(tipos).toEqual(expect.arrayContaining([
      "reactivacion", "venta_cruzada", "margen_bajo", "inmovilizado", "atencion_pedido", "atencion_reclamo",
      "cobro_vencido", "vencimiento", "reponer", "mora_media", "flujo_negativo",
      "seguimiento", "churn_perdido", "competencia_por_encima", "ajuste_precio",
      "comprar", "entrega", "proceso", "postventa_resena", "venta", "prospecto",
    ]));
    expect(items.every((r) => r.tenantId === "demo" && !!r.id && !!r.creadoEn)).toBe(true);
  });

  it("enforcement + acción (Acción → Resultado): manual pide aprobación, autónomo ejecuta", async () => {
    const app = crearApp();
    const handler = app.tools.enviar_whatsapp!;
    const params = { to: "c1", texto: "Hola Ana, ¿retomamos?" };

    const manual = evaluarEscritura({ agentId: "whatsapp", tool: "enviar_whatsapp", toolInput: params, agentAutonomy: "manual" });
    const r1 = await ejecutarAccion({ ctx, store: app.store, handler, params, decision: manual });
    expect(r1.estado).toBe("pendiente_aprobacion");
    expect(app.outbox.whatsapp).toHaveLength(0);

    const auto = evaluarEscritura({ agentId: "whatsapp", tool: "enviar_whatsapp", toolInput: params, agentAutonomy: "autonomous" });
    const r2 = await ejecutarAccion({ ctx, store: app.store, handler, params, decision: auto });
    expect(r2.estado).toBe("ejecutada");
    expect(app.outbox.whatsapp).toEqual([{ to: "c1", texto: "Hola Ana, ¿retomamos?" }]);
    expect((await app.store.actionResults.list(ctx)).items).toHaveLength(1);
  });

  it("memoria: una decisión de rechazo bloquea la siguiente escritura", async () => {
    const app = crearApp();
    await registrarDecision(app.store, ctx, "rechazo", {
      actor: "usuario", cuando: new Date().toISOString(), accion: "enviar_whatsapp",
      entityType: "contacto", entityId: "c1",
    });
    const decisiones = (await app.store.memory.list(ctx)).items.map((m) => ({ kind: m.kind, value: m.contenido as never }));
    const d = evaluarEscritura({
      agentId: "whatsapp", tool: "enviar_whatsapp", toolInput: { to: "c1" }, agentAutonomy: "autonomous", decisiones,
    });
    expect(d.permitido).toBe(false);
    expect(d.motivo).toMatch(/decisión previa/);
  });

  it("impacto (Resultado → Impacto)", async () => {
    const app = crearApp();
    await registrarImpacto(app.store, ctx, { recomendacionId: "r1", metrica: "ingreso_recuperado", valor: 80_000 });
    const { items } = await app.store.impacts.list(ctx);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ tenantId: "demo", valor: 80_000 });
  });

  it("AI gateway: atribuye gasto por tenant/agente", async () => {
    const app = crearApp();
    const res = await app.gateway.complete(ctx, { messages: [{ role: "user", content: "redactá un saludo" }], agentId: "whatsapp" });
    expect(res.text).toContain("Respuesta redactada");
    expect(await app.store.gastoIA!.totalPorTenant(ctx)).toBeGreaterThan(0);
    expect(app.store._gasto.some((g) => g.agentId === "whatsapp" && g.tenantId === "demo")).toBe(true);
  });

  it("aislamiento por tenant: otro tenant no ve datos ni recomendaciones de demo", async () => {
    const app = crearApp();
    const otro: TenantCtx = { tenantId: "otro" };
    const crm = catalogo.find((a) => a.manifest.id === "crm")!;

    // Corre crm para ambos tenants: demo tiene datos, "otro" no.
    await runAgent({ agent: crm, ctx, providers: app.providers, store: app.store, modeloNegocio: app.modeloNegocio });
    await runAgent({ agent: crm, ctx: otro, providers: app.providers, store: app.store, modeloNegocio: app.modeloNegocio });

    expect((await app.store.recommendations.list(ctx)).items.length).toBeGreaterThan(0);
    expect((await app.store.recommendations.list(otro)).items).toHaveLength(0);
  });
});
