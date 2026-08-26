import { describe, it, expect } from "vitest";
import { clasificarMora } from "./morosidad.logic";

describe("clasificarMora", () => {
  it("no vencido → sin alerta", () => {
    expect(clasificarMora(0)).toBeNull();
    expect(clasificarMora(-3)).toBeNull();
  });
  it("escalona por días (temprana/media/avanzada/incobrable)", () => {
    expect(clasificarMora(10)?.nivel).toBe("temprana");
    expect(clasificarMora(35)?.nivel).toBe("media");
    expect(clasificarMora(70)?.nivel).toBe("avanzada");
    expect(clasificarMora(120)?.nivel).toBe("incobrable_probable");
  });
  it("la severidad sube con el nivel", () => {
    expect(clasificarMora(10)?.severidad).toBe("oportunidad");
    expect(clasificarMora(35)?.severidad).toBe("importante");
    expect(clasificarMora(120)?.severidad).toBe("critica");
  });
  it("cada nivel trae su acción escalonada", () => {
    expect(clasificarMora(120)?.accion).toContain("incobrable");
    expect(clasificarMora(10)?.accion).toContain("recordatorio");
  });
});
