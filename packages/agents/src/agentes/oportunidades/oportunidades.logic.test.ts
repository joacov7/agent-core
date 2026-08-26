import { describe, it, expect } from "vitest";
import { detectarVentaCruzada, confianzaPorSoporte } from "./oportunidades.logic";
import type { ParComplementario, ClienteProductos } from "./oportunidades.logic";

const pares: ParComplementario[] = [
  { a: "mate", b: "bombilla", nombre_a: "Mate", nombre_b: "Bombilla", co: 6 },
  { a: "mate", b: "termo", nombre_a: "Mate", nombre_b: "Termo", co: 3 },
  { a: "yerba", b: "azucarera", nombre_a: "Yerba", nombre_b: "Azucarera", co: 2 },
];

describe("confianzaPorSoporte", () => {
  it("escala por co-ocurrencias", () => {
    expect(confianzaPorSoporte(6)).toBe(80);
    expect(confianzaPorSoporte(3)).toBe(65);
    expect(confianzaPorSoporte(2)).toBe(50);
  });
});

describe("detectarVentaCruzada", () => {
  it("sugiere el complementario que falta", () => {
    const clientes: ClienteProductos[] = [{ email: "a@x.com", nombre: "Ana", productos: ["mate"] }];
    const out = detectarVentaCruzada(pares, clientes);
    const sugeridos = out.map(o => o.sugerido);
    expect(sugeridos).toContain("bombilla");
    expect(sugeridos).toContain("termo");
  });

  it("no sugiere lo que el cliente ya tiene", () => {
    const clientes: ClienteProductos[] = [{ email: "a@x.com", nombre: "Ana", productos: ["mate", "bombilla"] }];
    const out = detectarVentaCruzada(pares, clientes);
    expect(out.map(o => o.sugerido)).not.toContain("bombilla");
    expect(out.map(o => o.sugerido)).toContain("termo");
  });

  it("funciona con el par al revés (cliente tiene el lado B)", () => {
    const clientes: ClienteProductos[] = [{ email: "a@x.com", nombre: "Ana", productos: ["bombilla"] }];
    const out = detectarVentaCruzada(pares, clientes);
    const mate = out.find(o => o.sugerido === "mate");
    expect(mate).toBeTruthy();
    expect(mate!.co).toBe(6);
  });

  it("respeta el tope por cliente", () => {
    const clientes: ClienteProductos[] = [{ email: "a@x.com", nombre: "Ana", productos: ["mate", "yerba"] }];
    const out = detectarVentaCruzada(pares, clientes, { maxPorCliente: 1 });
    expect(out.filter(o => o.email === "a@x.com").length).toBe(1);
    expect(out[0].sugerido).toBe("bombilla"); // el de mayor co-ocurrencia
  });

  it("cliente sin nada en común → sin oportunidades", () => {
    const clientes: ClienteProductos[] = [{ email: "z@x.com", nombre: "Zoe", productos: ["algo-raro"] }];
    expect(detectarVentaCruzada(pares, clientes)).toHaveLength(0);
  });
});
