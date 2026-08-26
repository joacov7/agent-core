import { describe, it, expect } from "vitest";
import {
  estaVigente, claveDecision, decisionBloqueante, vencimientoEnDias,
} from "./memoria-estructurada.logic";
import type { DecisionValue } from "./memoria-estructurada.logic";

function dec(o: Partial<DecisionValue>): DecisionValue {
  return { actor: "usuario", cuando: new Date().toISOString(), accion: "aplicar_precio", entityType: "producto", entityId: "X", ...o };
}

describe("estaVigente", () => {
  it("sin vencimiento → permanente", () => {
    expect(estaVigente(dec({ vigente_hasta: null }))).toBe(true);
  });
  it("futuro → vigente", () => {
    const manana = new Date(Date.now() + 86400000).toISOString();
    expect(estaVigente(dec({ vigente_hasta: manana }))).toBe(true);
  });
  it("pasado → vencida", () => {
    const ayer = new Date(Date.now() - 86400000).toISOString();
    expect(estaVigente(dec({ vigente_hasta: ayer }))).toBe(false);
  });
});

describe("claveDecision", () => {
  it("arma clave estable por entidad+acción", () => {
    expect(claveDecision("producto", "42", "aplicar_precio")).toBe("decision:producto:42:aplicar_precio");
  });
});

describe("vencimientoEnDias", () => {
  it("null/0 → sin vencimiento", () => {
    expect(vencimientoEnDias(null)).toBeNull();
    expect(vencimientoEnDias(0)).toBeNull();
  });
  it("30 días → ISO en el futuro", () => {
    const v = vencimientoEnDias(30, new Date("2026-01-01T00:00:00Z"));
    expect(v).toBe(new Date("2026-01-31T00:00:00Z").toISOString());
  });
});

describe("decisionBloqueante", () => {
  it("un 'rechazo' vigente de la misma acción bloquea", () => {
    const b = decisionBloqueante([{ kind: "rechazo", value: dec({ vigente_hasta: null }) }], "aplicar_precio");
    expect(b).toBeTruthy();
  });
  it("una 'preferencia' NO bloquea", () => {
    const b = decisionBloqueante([{ kind: "preferencia", value: dec({}) }], "aplicar_precio");
    expect(b).toBeNull();
  });
  it("un rechazo VENCIDO no bloquea", () => {
    const ayer = new Date(Date.now() - 86400000).toISOString();
    const b = decisionBloqueante([{ kind: "rechazo", value: dec({ vigente_hasta: ayer }) }], "aplicar_precio");
    expect(b).toBeNull();
  });
  it("un rechazo de OTRA acción no bloquea", () => {
    const b = decisionBloqueante([{ kind: "rechazo", value: dec({ accion: "enviar_whatsapp" }) }], "aplicar_precio");
    expect(b).toBeNull();
  });
});
