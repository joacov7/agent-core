import { describe, it, expect } from "vitest";
import type { Agent, AgenteConfig, AgentManifest } from "@agent-core/contracts";
import { resolverSeleccion, autonomiaEfectiva } from "./seleccion.js";

function agente(id: string, over: Partial<AgentManifest> = {}): Agent {
  const manifest: AgentManifest = {
    id, version: "0.1.0", nombre: id, descripcion: "", categoria: "operaciones",
    requiereCapacidades: [], requiereTools: [], nivelIA: "ninguno", costoEstimado: "cero",
    frecuenciaRecomendada: "diaria", emiteAcciones: false, toolsDeEscritura: [],
    riesgo: "bajo", autonomiaMaxima: "manual", ...over,
  };
  return { manifest, async run() { return { recomendaciones: [] }; } };
}
function cfg(agentId: string, over: Partial<AgenteConfig> = {}): AgenteConfig {
  return { tenantId: "t1", agentId, encendido: true, autonomia: "manual", ...over };
}

const app = { capacidades: ["contacts", "receivables"] as const };

describe("autonomiaEfectiva", () => {
  it("respeta la elegida cuando no supera el máximo", () => {
    expect(autonomiaEfectiva("manual", "autonomous")).toBe("manual");
    expect(autonomiaEfectiva("assisted", "assisted")).toBe("assisted");
  });
  it("acota al máximo del manifest", () => {
    expect(autonomiaEfectiva("autonomous", "assisted")).toBe("assisted");
    expect(autonomiaEfectiva("assisted", "manual")).toBe("manual");
  });
});

describe("resolverSeleccion", () => {
  const catalogo = [
    agente("cobros", { requiereCapacidades: ["receivables", "contacts"], autonomiaMaxima: "assisted" }),
    agente("nps", { requiereCapacidades: ["feedback"] }), // NO activable (falta feedback)
    agente("ceo", { requiereCapacidades: [] }),
  ];

  it("por defecto (apagado): no corre nada sin config", () => {
    expect(resolverSeleccion(catalogo, app, [])).toHaveLength(0);
  });

  it("por defecto encendido: corre los ACTIVABLES (no los que faltan capacidad)", () => {
    const sel = resolverSeleccion(catalogo, app, [], { pordefecto: "encendido" });
    expect(sel.map((s) => s.agent.manifest.id).sort()).toEqual(["ceo", "cobros"]);
  });

  it("respeta encendido/apagado explícito de la config", () => {
    const sel = resolverSeleccion(catalogo, app, [cfg("cobros"), cfg("ceo", { encendido: false })]);
    expect(sel.map((s) => s.agent.manifest.id)).toEqual(["cobros"]);
  });

  it("acota la autonomía elegida al máximo del manifest", () => {
    const sel = resolverSeleccion(catalogo, app, [cfg("cobros", { autonomia: "autonomous" })]);
    expect(sel[0]!.autonomia).toBe("assisted"); // cobros topea en assisted
  });

  it("propaga plan y config; nunca enciende un no-activable", () => {
    const sel = resolverSeleccion(catalogo, app, [
      cfg("cobros", { plan: "Pro", config: { diasCritico: 45 } }),
      cfg("nps", { encendido: true }), // activado pero NO activable → no corre
    ], { pordefecto: "encendido" });
    const cobros = sel.find((s) => s.agent.manifest.id === "cobros")!;
    expect(cobros.plan).toBe("Pro");
    expect(cobros.config).toEqual({ diasCritico: 45 });
    expect(sel.some((s) => s.agent.manifest.id === "nps")).toBe(false);
  });
});
