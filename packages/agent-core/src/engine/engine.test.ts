import { describe, it, expect } from "vitest";
import type {
  Agent, AgentManifest, CoreStore, EntradaMemoria, Impacto, RecomendacionNueva,
  ResultadoAccion, Recomendacion, TenantCtx, WriteToolHandler,
} from "@agent-core/contracts";
import {
  runAgent, AgenteNoActivableError, evaluarEscritura, ejecutarAccion,
  registrarDecision, registrarImpacto,
} from "./index.js";

// ─── Fakes en memoria ─────────────────────────────────────────────────────────
type StoreFake = CoreStore & {
  _recos: Recomendacion[]; _results: ResultadoAccion[]; _mem: EntradaMemoria[];
  _impacts: Impacto[];
};

function crearStore(): StoreFake {
  const recos: Recomendacion[] = [];
  const results: ResultadoAccion[] = [];
  const mem: EntradaMemoria[] = [];
  const impacts: Impacto[] = [];
  return {
    _recos: recos, _results: results, _mem: mem, _impacts: impacts,
    recommendations: {
      async save(_ctx, r) {
        const i = recos.findIndex((x) => x.id === r.id);
        if (i >= 0) recos[i] = r; else recos.push(r); // idempotente por id (upsert), como los stores reales
        return r;
      },
      async get(_ctx, id) { return recos.find((x) => x.id === id) ?? null; },
      async list() { return { items: recos }; },
    },
    actionResults: {
      async save(_ctx, r) { results.push(r); return r; },
      async list() { return { items: results }; },
    },
    impacts: {
      async save(_ctx, i) { impacts.push(i); return i; },
      async list() { return { items: impacts }; },
      async byRecomendacion(_ctx, recomendacionId) { return impacts.filter((i) => i.recomendacionId === recomendacionId); },
    },
    memory: {
      async put(_ctx, e) { mem.push(e); return e; },
      async get(_ctx, ns, clave) { return mem.find((m) => m.namespace === ns && m.clave === clave) ?? null; },
      async list() { return { items: mem }; },
    },
  };
}

const ctx: TenantCtx = { tenantId: "t1" };
const deterministas = { generarId: () => "id-1", now: () => new Date("2026-01-01T00:00:00.000Z") };

function mani(over: Partial<AgentManifest>): AgentManifest {
  return {
    id: "fake", version: "0.1.0", nombre: "Fake", descripcion: "",
    categoria: "clientes", requiereCapacidades: [], requiereTools: [],
    nivelIA: "ninguno", costoEstimado: "cero", frecuenciaRecomendada: "diaria",
    emiteAcciones: false, toolsDeEscritura: [], riesgo: "bajo", autonomiaMaxima: "manual",
    ...over,
  };
}

const unaReco: RecomendacionNueva = {
  agentId: "fake", tipo: "t", titulo: "T", estado: "proposed",
  severidad: "oportunidad", confianza: 60, prioridad: 3,
};

function agente(manifest: AgentManifest, recos: RecomendacionNueva[] = [unaReco]): Agent {
  return { manifest, async run() { return { recomendaciones: recos, resumen: "ok" }; } };
}

// ─── runAgent ─────────────────────────────────────────────────────────────────
describe("runAgent", () => {
  it("falla cerrado sin TenantCtx", async () => {
    const store = crearStore();
    await expect(
      runAgent({ agent: agente(mani({})), ctx: {} as TenantCtx, providers: {}, store }),
    ).rejects.toThrow(/TenantCtx/);
  });

  it("persiste las recomendaciones con id/tenant/timestamp", async () => {
    const store = crearStore();
    const res = await runAgent({
      agent: agente(mani({ requiereCapacidades: ["contacts"] })),
      ctx, providers: { contacts: {} as never }, store, deps: deterministas,
    });
    expect(res.recomendaciones).toHaveLength(1);
    expect(res.recomendaciones[0]).toMatchObject({
      id: "id-1", tenantId: "t1", creadoEn: "2026-01-01T00:00:00.000Z", tipo: "t",
    });
    expect(store._recos).toHaveLength(1);
    expect(res.resumen).toBe("ok");
  });

  it("rechaza un agente no activable (falta capacidad)", async () => {
    const store = crearStore();
    await expect(
      runAgent({
        agent: agente(mani({ requiereCapacidades: ["transactions"] })),
        ctx, providers: { contacts: {} as never }, store,
      }),
    ).rejects.toBeInstanceOf(AgenteNoActivableError);
  });

  it("rechaza por modelo de negocio incompatible (retail en proyecto)", async () => {
    const store = crearStore();
    await expect(
      runAgent({
        agent: agente(mani({ requiereCapacidades: ["contacts"], modelosNegocio: ["transaccional_repetitivo"] })),
        ctx, providers: { contacts: {} as never }, store, modeloNegocio: "proyecto",
      }),
    ).rejects.toBeInstanceOf(AgenteNoActivableError);
  });
});

// ─── enforcement ──────────────────────────────────────────────────────────────
describe("evaluarEscritura", () => {
  const base = { agentId: "a", tool: "aplicar_precio", toolInput: {} as unknown };

  it("por defecto permite pero pide aprobación si el agente es manual", () => {
    expect(evaluarEscritura({ ...base, agentAutonomy: "manual" }))
      .toEqual({ permitido: true, requiereAprobacion: true });
  });

  it("un agente autónomo puede ejecutar sin aprobación", () => {
    expect(evaluarEscritura({ ...base, agentAutonomy: "autonomous" }))
      .toEqual({ permitido: true, requiereAprobacion: false });
  });

  it("bloquea una entidad protegida", () => {
    const d = evaluarEscritura({
      agentId: "a", tool: "aplicar_precio", toolInput: {},
      entidadesAfectadas: [{ tipo: "catalogo_item", id: "P1" }],
      agentAutonomy: "autonomous",
      policies: { global: { protectedEntities: [{ tipo: "catalogo_item", id: "P1" }] } },
    });
    expect(d.permitido).toBe(false);
  });

  it("bloquea si hay una decisión de rechazo vigente en memoria", () => {
    const d = evaluarEscritura({
      agentId: "a", tool: "aplicar_precio", toolInput: {}, agentAutonomy: "autonomous",
      decisiones: [{ kind: "rechazo", value: { actor: "u", cuando: new Date().toISOString(), accion: "aplicar_precio" } }],
    });
    expect(d.permitido).toBe(false);
    expect(d.motivo).toMatch(/decisión previa/);
  });
});

// ─── ejecutarAccion (Acción → Resultado) ──────────────────────────────────────
describe("ejecutarAccion", () => {
  const handlerOk: WriteToolHandler = {
    definicion: { id: "aplicar_precio", tipo: "escritura", descripcion: "" },
    async ejecutar() { return { done: true }; },
  };

  it("no ejecuta si está bloqueada", async () => {
    const store = crearStore();
    const r = await ejecutarAccion({
      ctx, store, handler: handlerOk, params: {},
      decision: { permitido: false, requiereAprobacion: true, motivo: "x" },
    });
    expect(r.estado).toBe("bloqueada");
    expect(store._results).toHaveLength(0);
  });

  it("no ejecuta si requiere aprobación", async () => {
    const store = crearStore();
    const r = await ejecutarAccion({
      ctx, store, handler: handlerOk, params: {},
      decision: { permitido: true, requiereAprobacion: true },
    });
    expect(r.estado).toBe("pendiente_aprobacion");
    expect(store._results).toHaveLength(0);
  });

  it("ejecuta y persiste el resultado ok", async () => {
    const store = crearStore();
    const r = await ejecutarAccion({
      ctx, store, handler: handlerOk, params: {},
      decision: { permitido: true, requiereAprobacion: false }, deps: deterministas,
    });
    expect(r.estado).toBe("ejecutada");
    expect(store._results).toHaveLength(1);
    expect(store._results[0]).toMatchObject({ ok: true, tipo: "ejecutada", tenantId: "t1" });
  });

  it("captura el error del handler como resultado fallido", async () => {
    const store = crearStore();
    const handlerErr: WriteToolHandler = {
      definicion: { id: "aplicar_precio", tipo: "escritura", descripcion: "" },
      async ejecutar() { throw new Error("boom"); },
    };
    const r = await ejecutarAccion({
      ctx, store, handler: handlerErr, params: {},
      decision: { permitido: true, requiereAprobacion: false }, deps: deterministas,
    });
    expect(r.estado).toBe("fallida");
    expect(store._results[0]).toMatchObject({ ok: false, tipo: "error", error: "boom" });
  });
});

// ─── impacto (Resultado → Impacto) ────────────────────────────────────────────
describe("registrarImpacto", () => {
  it("persiste el impacto con id/tenant y default de medidoEn", async () => {
    const store = crearStore();
    const imp = await registrarImpacto(store, ctx, {
      recomendacionId: "rec-1", metrica: "ingreso", valor: 12500,
    }, deterministas);
    expect(imp).toMatchObject({
      id: "id-1", tenantId: "t1", medidoEn: "2026-01-01T00:00:00.000Z", valor: 12500,
    });
    const porReco = await store.impacts.byRecomendacion(ctx, "rec-1");
    expect(porReco).toHaveLength(1);
  });
});

// ─── memoria: write que el enforcement después lee ────────────────────────────
describe("registrarDecision + enforcement", () => {
  it("una decisión de rechazo guardada bloquea la siguiente escritura", async () => {
    const store = crearStore();
    await registrarDecision(store, ctx, "rechazo", {
      actor: "u", cuando: new Date().toISOString(), accion: "aplicar_precio",
      entityType: "contacto", entityId: "c1",
    }, deterministas);

    expect(store._mem).toHaveLength(1);
    expect(store._mem[0]).toMatchObject({ namespace: "decision", kind: "rechazo", tenantId: "t1" });

    const decision = evaluarEscritura({
      agentId: "a", tool: "aplicar_precio", toolInput: {}, agentAutonomy: "autonomous",
      decisiones: store._mem.map((m) => ({ kind: m.kind, value: m.contenido as never })),
    });
    expect(decision.permitido).toBe(false);
  });
});

describe("runAgent: dedup de recomendaciones vivas", () => {
  const conClave = (over: Partial<RecomendacionNueva> = {}): RecomendacionNueva => ({
    agentId: "fake", tipo: "cobro_vencido", titulo: "Cobrar (vencido hace 10 días)", estado: "proposed",
    severidad: "importante", confianza: 90, prioridad: 2, dedupKey: "fake:cobro:1", ...over,
  });
  const agente = (salida: () => RecomendacionNueva[]): Agent => ({ manifest: mani({}), run: async () => ({ recomendaciones: salida() }) });
  let n = 0;
  const idsSecuenciales = () => ({ generarId: () => `id-${++n}`, now: () => new Date(`2026-01-0${Math.min(n + 1, 9)}T00:00:00.000Z`) });

  it("volver a detectar lo mismo REFRESCA la existente: sin duplicar, conserva id/creadoEn/estado", async () => {
    n = 0;
    const store = crearStore();
    await runAgent({ agent: agente(() => [conClave()]), ctx, providers: {}, store, deps: idsSecuenciales() });
    // En el medio, alguien la mueve de estado (p.ej. queda pendiente de aprobación).
    store._recos[0] = { ...store._recos[0]!, estado: "pending_approval" };

    const r = await runAgent({
      agent: agente(() => [conClave({ titulo: "Cobrar (vencido hace 11 días)", severidad: "critica", prioridad: 1 })]),
      ctx, providers: {}, store, deps: idsSecuenciales(),
    });

    expect(store._recos).toHaveLength(1);                                   // no se duplicó
    expect(store._recos[0]).toMatchObject({
      id: "id-1", titulo: "Cobrar (vencido hace 11 días)", severidad: "critica", prioridad: 1, // datos nuevos
      estado: "pending_approval", creadoEn: "2026-01-02T00:00:00.000Z",     // estado e historia, intactos
    });
    expect(store._recos[0]!.actualizadoEn).toBeDefined();
    expect(r.recomendaciones).toHaveLength(1);                              // la corrida igual informa lo detectado
  });

  it("si la anterior ya está cerrada (ejecutada/rechazada), se crea una nueva", async () => {
    n = 0;
    const store = crearStore();
    await runAgent({ agent: agente(() => [conClave()]), ctx, providers: {}, store, deps: idsSecuenciales() });
    store._recos[0] = { ...store._recos[0]!, estado: "executed" };
    await runAgent({ agent: agente(() => [conClave()]), ctx, providers: {}, store, deps: idsSecuenciales() });
    expect(store._recos).toHaveLength(2);
    expect(store._recos.map((r) => r.estado)).toEqual(["executed", "proposed"]);
  });

  it("sin dedupKey no se deduplica; y otro agente con la misma clave no se pisa", async () => {
    n = 0;
    const store = crearStore();
    const sinClave = () => [conClave({ dedupKey: null })];
    await runAgent({ agent: agente(sinClave), ctx, providers: {}, store, deps: idsSecuenciales() });
    await runAgent({ agent: agente(sinClave), ctx, providers: {}, store, deps: idsSecuenciales() });
    expect(store._recos).toHaveLength(2);

    const store2 = crearStore();
    await runAgent({ agent: agente(() => [conClave()]), ctx, providers: {}, store: store2, deps: idsSecuenciales() });
    const otro: Agent = { manifest: mani({ id: "otro" }), run: async () => ({ recomendaciones: [conClave({ agentId: "otro" })] }) };
    await runAgent({ agent: otro, ctx, providers: {}, store: store2, deps: idsSecuenciales() });
    expect(store2._recos.map((r) => r.agentId).sort()).toEqual(["fake", "otro"]);
  });

  it("dos recomendaciones con la misma clave en una MISMA corrida quedan en una", async () => {
    n = 0;
    const store = crearStore();
    await runAgent({ agent: agente(() => [conClave(), conClave({ titulo: "otra versión" })]), ctx, providers: {}, store, deps: idsSecuenciales() });
    expect(store._recos).toHaveLength(1);
    expect(store._recos[0]!.titulo).toBe("otra versión");
  });
});
