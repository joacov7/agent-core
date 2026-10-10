import { describe, it, expect } from "vitest";
import type {
  AgenteConfig, EntradaMemoria, GastoIA, Impacto, Recomendacion, ResultadoAccion, TenantCtx,
} from "@agent-core/contracts";
import { crearCoreStorePrisma } from "./index.js";
import type { PrismaLike } from "./prisma-like.js";

// ── Fake in-memory de PrismaLike: valida el mapeo canónico↔fila y el aislamiento por
//    tenant del adapter, sin un Postgres real. Honesto: testea la lógica del adapter,
//    no la DB (eso es un test de integración aparte, con un Postgres de servicio). ──
function tabla() {
  const rows: Record<string, unknown>[] = [];
  const match = (row: Record<string, unknown>, where?: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(where ?? {})) {
      if (k === "tenantId_agentId") {
        const cv = v as { tenantId: string; agentId: string };
        if (row.tenantId !== cv.tenantId || row.agentId !== cv.agentId) return false;
      } else if (row[k] !== v) return false;
    }
    return true;
  };
  return {
    rows,
    async findMany(args?: { where?: Record<string, unknown> }) { return rows.filter((r) => match(r, args?.where)) as never; },
    async findFirst(args: { where?: Record<string, unknown> }) { return (rows.find((r) => match(r, args.where)) ?? null) as never; },
    async create(args: { data: Record<string, unknown> }) { const row = { ...args.data }; rows.push(row); return row as never; },
    async upsert(args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) {
      const ex = rows.find((r) => match(r, args.where));
      if (ex) { Object.assign(ex, args.update); return ex as never; }
      const row = { ...args.create }; rows.push(row); return row as never;
    },
  };
}
function fakePrisma(): PrismaLike {
  return {
    recomendacion: tabla(), resultadoAccion: tabla(), impacto: tabla(),
    entradaMemoria: tabla(), gastoIA: tabla(), agenteConfig: tabla(),
  };
}

const t1: TenantCtx = { tenantId: "t1" };
const t2: TenantCtx = { tenantId: "t2" };
const base = { creadoEn: "2026-10-10T00:00:00.000Z" };

describe("crearCoreStorePrisma", () => {
  it("recommendations: persiste, lee por id y aísla por tenant", async () => {
    const store = crearCoreStorePrisma(fakePrisma());
    const reco: Recomendacion = { id: "r1", tenantId: "t1", agentId: "cobros", tipo: "cobro_vencido", titulo: "X", estado: "proposed", severidad: "critica", confianza: 100, prioridad: 1, ...base };
    await store.recommendations.save(t1, reco);

    expect((await store.recommendations.get(t1, "r1"))?.tipo).toBe("cobro_vencido");
    expect(await store.recommendations.get(t2, "r1")).toBeNull();
    expect((await store.recommendations.list(t1)).items).toHaveLength(1);
    expect((await store.recommendations.list(t2)).items).toHaveLength(0);
  });

  it("memory: get por namespace+clave, aislado", async () => {
    const store = crearCoreStorePrisma(fakePrisma());
    const e: EntradaMemoria = { id: "m1", tenantId: "t1", namespace: "decision", clave: "c1:enviar", contenido: { v: 1 }, ...base };
    await store.memory.put(t1, e);
    expect((await store.memory.get(t1, "decision", "c1:enviar"))?.id).toBe("m1");
    expect(await store.memory.get(t1, "decision", "otra")).toBeNull();
    expect(await store.memory.get(t2, "decision", "c1:enviar")).toBeNull();
  });

  it("impacts: byRecomendacion filtra por tenant + reco", async () => {
    const store = crearCoreStorePrisma(fakePrisma());
    const i: Impacto = { id: "i1", tenantId: "t1", recomendacionId: "r1", metrica: "ingreso", valor: 100, medidoEn: base.creadoEn, ...base };
    await store.impacts.save(t1, i);
    expect(await store.impacts.byRecomendacion(t1, "r1")).toHaveLength(1);
    expect(await store.impacts.byRecomendacion(t1, "rX")).toHaveLength(0);
    expect(await store.impacts.byRecomendacion(t2, "r1")).toHaveLength(0);
  });

  it("actionResults: persiste y lista por tenant", async () => {
    const store = crearCoreStorePrisma(fakePrisma());
    const res: ResultadoAccion = { id: "res1", tenantId: "t1", accionId: "a1", ok: true, ...base };
    await store.actionResults.save(t1, res);
    expect((await store.actionResults.list(t1)).items[0]?.accionId).toBe("a1");
    expect((await store.actionResults.list(t2)).items).toHaveLength(0);
  });

  it("gastoIA: totales por tenant y por agente, con corte desde", async () => {
    const store = crearCoreStorePrisma(fakePrisma());
    const g = (id: string, tenantId: string, agentId: string, costo: number, creadoEn: string): GastoIA =>
      ({ id, tenantId, agentId, model: "m", inputTokens: 1, outputTokens: 1, costo, creadoEn });
    await store.gastoIA!.registrar(t1, g("g1", "t1", "whatsapp", 10, "2026-10-01T00:00:00.000Z"));
    await store.gastoIA!.registrar(t1, g("g2", "t1", "ceo", 5, "2026-10-09T00:00:00.000Z"));
    await store.gastoIA!.registrar(t2, g("g3", "t2", "whatsapp", 99, "2026-10-09T00:00:00.000Z"));

    expect(await store.gastoIA!.totalPorTenant(t1)).toBe(15);
    expect(await store.gastoIA!.totalPorTenant(t2)).toBe(99);
    expect(await store.gastoIA!.totalPorAgente(t1, "whatsapp")).toBe(10);
    expect(await store.gastoIA!.totalPorTenant(t1, "2026-10-05T00:00:00.000Z")).toBe(5); // solo g2
  });

  it("agentConfig: upsert (insert y update), aislado por tenant", async () => {
    const store = crearCoreStorePrisma(fakePrisma());
    await store.agentConfig!.set(t1, { agentId: "cobros", encendido: true, autonomia: "manual", plan: "Pro" });
    await store.agentConfig!.set(t1, { agentId: "cobros", encendido: false, autonomia: "manual" }); // update

    const cfgs = await store.agentConfig!.list(t1);
    expect(cfgs).toHaveLength(1);
    expect(cfgs[0]!.encendido).toBe(false);
    expect((await store.agentConfig!.get(t1, "cobros"))?.tenantId).toBe("t1");
    expect(await store.agentConfig!.list(t2)).toHaveLength(0);
  });
});
