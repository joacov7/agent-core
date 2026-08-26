import { describe, it, expect } from "vitest";
import type { AgentManifest } from "@agent-core/contracts";
import {
  cubreCapacidades, cumpleModeloNegocio, esActivable, manifestsActivables,
} from "./activacion.js";

function mani(over: Partial<AgentManifest>): AgentManifest {
  return {
    id: "x", version: "0.1.0", nombre: "X", descripcion: "",
    categoria: "clientes", requiereCapacidades: [], requiereTools: [],
    nivelIA: "ninguno", costoEstimado: "cero", frecuenciaRecomendada: "diaria",
    emiteAcciones: false, toolsDeEscritura: [], riesgo: "bajo", autonomiaMaxima: "manual",
    ...over,
  };
}

describe("cubreCapacidades", () => {
  it("true si la app cubre todas las requeridas", () => {
    const m = mani({ requiereCapacidades: ["contacts", "transactions"] });
    expect(cubreCapacidades(m, { capacidades: ["contacts", "transactions", "catalog"] })).toBe(true);
  });
  it("false si falta alguna", () => {
    const m = mani({ requiereCapacidades: ["contacts", "transactions"] });
    expect(cubreCapacidades(m, { capacidades: ["contacts"] })).toBe(false);
  });
  it("sin requisitos → siempre true", () => {
    expect(cubreCapacidades(mani({}), { capacidades: [] })).toBe(true);
  });
});

describe("cumpleModeloNegocio", () => {
  it("sin restricción → cualquier cadencia (incluso sin declarar)", () => {
    expect(cumpleModeloNegocio(mani({}), { capacidades: [] })).toBe(true);
  });
  it("con restricción y modelo incluido → true", () => {
    const m = mani({ modelosNegocio: ["transaccional_repetitivo", "suscripcion"] });
    expect(cumpleModeloNegocio(m, { capacidades: [], modeloNegocio: "suscripcion" })).toBe(true);
  });
  it("con restricción y modelo NO incluido → false", () => {
    const m = mani({ modelosNegocio: ["transaccional_repetitivo"] });
    expect(cumpleModeloNegocio(m, { capacidades: [], modeloNegocio: "proyecto" })).toBe(false);
  });
  it("con restricción pero la app no declara modelo → false", () => {
    const m = mani({ modelosNegocio: ["transaccional_repetitivo"] });
    expect(cumpleModeloNegocio(m, { capacidades: [] })).toBe(false);
  });
});

describe("esActivable / manifestsActivables", () => {
  it("combina capacidades y modelo de negocio", () => {
    const crm = mani({
      id: "crm", requiereCapacidades: ["contacts", "transactions"],
      modelosNegocio: ["transaccional_repetitivo"],
    });
    expect(esActivable(crm, {
      capacidades: ["contacts", "transactions"], modeloNegocio: "transaccional_repetitivo",
    })).toBe(true);
    // Estudio jurídico (proyecto): no se activa un agente de retail.
    expect(esActivable(crm, {
      capacidades: ["contacts", "transactions"], modeloNegocio: "proyecto",
    })).toBe(false);
  });

  it("filtra el catálogo a los activables", () => {
    const agentes = [
      { manifest: mani({ id: "generico" }) },
      { manifest: mani({ id: "crm", requiereCapacidades: ["transactions"], modelosNegocio: ["transaccional_repetitivo"] }) },
    ];
    const soloContacts = manifestsActivables(agentes, { capacidades: ["contacts"] });
    expect(soloContacts.map((a) => a.manifest.id)).toEqual(["generico"]);
  });
});
