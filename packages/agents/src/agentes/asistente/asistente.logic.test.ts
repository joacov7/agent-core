import { describe, it, expect } from "vitest";
import type { Recomendacion, TenantCtx } from "@agent-core/contracts";
import { catalogo } from "../../catalogo.js";
import { abiertas, agenteAsistente, claveAviso, componerAlerta, componerResumen } from "./index.js";

let n = 0;
const reco = (over: Partial<Recomendacion> = {}): Recomendacion => ({
  id: `r${++n}`, tenantId: "t1", creadoEn: "2026-10-29T00:00:00.000Z", agentId: "cobros", tipo: "cobro_vencido",
  titulo: "Cobrar 15000 ARS (vencido hace 30 día(s))", estado: "proposed", severidad: "critica", confianza: 95,
  prioridad: 1, impactoEstimado: 15000, refEntidad: { tipo: "cobro", id: `c${n}` }, ...over,
});
const base = { fecha: "2026-10-29", nombres: { cobros: "Lou", sistemas: "Yuri", morosidad: "Maxi" }, roles: { cobros: "Cobros", sistemas: "Sistemas", morosidad: "Morosidad" } };

describe("componerResumen", () => {
  it("sin hallazgos abiertos: todo tranquilo", () => {
    expect(componerResumen([], base)).toBe("☀️ Buen día · resumen del 29/10\n\nTodo tranquilo: no hay hallazgos abiertos.");
    expect(componerResumen([reco({ estado: "executed" }), reco({ estado: "rejected" })], base)).toContain("Todo tranquilo");
  });

  it("agrupa por severidad y agente; con muchos hallazgos suma el monto y muestra el más urgente", () => {
    const recos = [
      ...Array.from({ length: 4 }, (_, i) => reco({ impactoEstimado: 10000, prioridad: i === 2 ? 1 : 2, titulo: `Cobrar #${i}` })),
      reco({ agentId: "sistemas", tipo: "incidente", titulo: "Torre Sur sin conexión", impactoEstimado: undefined, refEntidad: { tipo: "incidente", id: "i1" } }),
      reco({ agentId: "morosidad", severidad: "importante", prioridad: 3, titulo: "Mora temprana" }),
      reco({ agentId: "morosidad", severidad: "oportunidad", prioridad: 4, titulo: "Recordar" }),
    ];
    const t = componerResumen(recos, base);
    expect(t).toContain("🔴 Críticas (5)");
    expect(t).toContain("• Lou · Cobros: 4 hallazgos, $40.000 en juego");
    expect(t).toContain("Más urgente: Cobrar #2");                          // la de prioridad 1
    expect(t).toContain("• Yuri · Sistemas: Torre Sur sin conexión");       // ≤2 → lista el título
    expect(t).toContain("🟠 Importantes (1)");
    expect(t).toContain("🔵 Oportunidades (1)");
    expect(t.indexOf("Críticas")).toBeLessThan(t.indexOf("Importantes"));
    expect(t.indexOf("Importantes")).toBeLessThan(t.indexOf("Oportunidades"));
  });

  it("privacidad: sin incluirNombres NO muestra a quién se refiere, aunque haya titulares", () => {
    const r = reco();
    const sin = componerResumen([r], { ...base, titulares: { [r.id]: "Ana Pérez" } });
    expect(sin).not.toContain("Ana");
    const con = componerResumen([r], { ...base, titulares: { [r.id]: "Ana Pérez" }, incluirNombres: true });
    expect(con).toContain("— Ana Pérez");
  });

  it("recorta a 4 agentes por severidad y agrega el link", () => {
    const recos = ["a", "b", "c", "d", "e", "f"].map((a) => reco({ agentId: a }));
    const t = componerResumen(recos, { ...base, url: "http://localhost:3100/bandeja" });
    expect(t).toContain("…y 2 agente(s) más");
    expect(t.endsWith("Abrí la bandeja: http://localhost:3100/bandeja")).toBe(true);
  });

  it("sin nombre ni rol conocidos cae al id del agente", () => {
    expect(componerResumen([reco({ agentId: "raro" })], { fecha: "2026-10-29" })).toContain("• raro:");
  });
});

describe("componerAlerta y claveAviso", () => {
  it("lista lo urgente (máx. 5) y cuenta el resto", () => {
    const t = componerAlerta(Array.from({ length: 7 }, (_, i) => reco({ prioridad: 1 + (i % 2), titulo: `Caída ${i}` })), { ...base, url: "http://x/bandeja" });
    expect(t.startsWith("🚨 Aviso urgente (7)")).toBe(true);
    expect(t.split("\n").filter((l) => l.startsWith("• Lou")).length).toBe(5);
    expect(t).toContain("…y 2 más en la bandeja");
    expect(t).toContain("Bandeja: http://x/bandeja");
  });

  it("la clave no cambia cuando el motor refresca el título (no se avisa dos veces de lo mismo)", () => {
    const a = reco({ dedupKey: "cobros:cobro:9", titulo: "vencido hace 11 días" });
    const b = { ...a, titulo: "vencido hace 12 días", prioridad: 1 };
    expect(claveAviso(a)).toBe(claveAviso(b));
    const c = reco({ dedupKey: null, tipo: "x", refEntidad: { tipo: "cobro", id: "9" } });
    expect(claveAviso(c)).toBe(claveAviso({ ...c, titulo: "otro título" }));
    expect(claveAviso(c)).not.toBe(claveAviso({ ...c, refEntidad: { tipo: "cobro", id: "10" } }));
  });

  it("abiertas() descarta las resueltas", () => {
    expect(abiertas([reco(), reco({ estado: "executed" }), reco({ estado: "pending_approval" }), reco({ estado: "cancelled" })])).toHaveLength(2);
  });
});

describe("agente Asistente personal", () => {
  it("es el último del catálogo, no emite acciones ni pide capacidades", () => {
    expect(catalogo.at(-1)!.manifest.id).toBe("asistente");
    expect(agenteAsistente.manifest).toMatchObject({ emiteAcciones: false, toolsDeEscritura: [], requiereCapacidades: [], autonomiaMaxima: "manual" });
  });

  it("run: no crea recomendaciones, deja el resumen del día con los nombres de los demás", async () => {
    const ctx: TenantCtx = { tenantId: "t1", now: () => new Date("2026-10-29T12:00:00Z") };
    const recos = [reco()];
    const out = await agenteAsistente.run({
      ctx, providers: {}, config: {},
      store: { recommendations: { save: async (_c, r) => r, get: async () => null, list: async () => ({ items: recos }) } } as never,
    });
    expect(out.recomendaciones).toEqual([]);
    expect(out.resumen).toContain("resumen del 29/10");
    expect(out.resumen).toContain("Lou · Cobros");
  });
});
