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
      async save(_ctx, r) { recos.push(r); return r; },
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
      agentId: "a", tool: "aplicar_precio", toolInput: { productId: "P1" },
      agentAutonomy: "autonomous", policies: { global: { protected_products: ["P1"] } },
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
