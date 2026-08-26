import { describe, it, expect } from "vitest";
import { sugerirPrecio } from "./precios.logic";

describe("sugerirPrecio", () => {
  it("caros vs mercado con margen holgado → bajar al mercado", () => {
    const s = sugerirPrecio({ precio: 1200, costo: 600, precioMercado: 900 });
    expect(s?.accion).toBe("bajar");
    expect(s?.precioSugerido).toBe(900);
  });
  it("baratos vs mercado → subir al mercado", () => {
    const s = sugerirPrecio({ precio: 800, costo: 400, precioMercado: 1000 });
    expect(s?.accion).toBe("subir");
    expect(s?.precioSugerido).toBe(1000);
  });
  it("no baja por debajo del piso de margen", () => {
    // mercado 700 pero costo 600 con margen mín 25% → piso 800
    const s = sugerirPrecio({ precio: 1200, costo: 600, precioMercado: 700 });
    expect(s?.precioSugerido).toBe(800);
  });
  it("cambio dentro de la tolerancia → mantener (null)", () => {
    expect(sugerirPrecio({ precio: 1000, costo: 500, precioMercado: 1020 })).toBeNull();
  });
});
