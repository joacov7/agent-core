import { describe, it, expect } from "vitest";
import { clasificarConversacion, intencionCompra, analizarConversacion } from "./whatsapp-intel.logic";

describe("clasificarConversacion", () => {
  it("detecta pedido", () => {
    expect(clasificarConversacion("hola, quiero comprar 3 mates")).toBe("pedido");
  });
  it("detecta precio", () => {
    expect(clasificarConversacion("cuánto sale el mate imperial?")).toBe("precio");
  });
  it("detecta reclamo (gana sobre precio)", () => {
    expect(clasificarConversacion("el mate llegó roto, quiero devolución")).toBe("reclamo");
  });
  it("detecta negociación", () => {
    expect(clasificarConversacion("me hacés descuento por 10 unidades?")).toBe("negociacion");
  });
  it("default consulta", () => {
    expect(clasificarConversacion("hola, buenas tardes")).toBe("consulta");
  });
});

describe("intencionCompra", () => {
  it("alta: quiere comprar + pregunta stock", () => {
    const s = intencionCompra("quiero comprar, tenés stock para entrega hoy?");
    expect(s).toBeGreaterThanOrEqual(60);
  });
  it("media: solo pregunta precio", () => {
    const s = intencionCompra("cuánto cuesta?");
    expect(s).toBe(25);
  });
  it("baja: solo mirando", () => {
    const s = intencionCompra("estoy mirando nomás, por las dudas pregunto precio");
    expect(s).toBeLessThan(25);
  });
  it("reclamo baja la intención", () => {
    const s = intencionCompra("tengo un reclamo, el producto no funciona");
    expect(s).toBe(0);
  });
  it("clamp 0-100", () => {
    const s = intencionCompra("quiero comprar 10 unidades ya, urgente, tenés stock? precio?");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("analizarConversacion", () => {
  it("devuelve tipo + intención", () => {
    const a = analizarConversacion("549111", "quiero comprar 2 mates, cuánto sale?");
    expect(a.wa_id).toBe("549111");
    expect(a.tipo).toBe("pedido");
    expect(a.intencion).toBeGreaterThan(50);
  });
});
