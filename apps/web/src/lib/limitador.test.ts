import { describe, expect, it } from "vitest";
import { crearLimitador } from "./limitador";

describe("limitador de intentos", () => {
  const nuevo = () => { let t = 1_000_000; const l = crearLimitador({ max: 3, ventanaMs: 60_000, ahora: () => t }); return { l, avanzar: (ms: number) => { t += ms; } }; };

  it("deja pasar hasta `max` fallas y después bloquea, diciendo cuánto falta", () => {
    const { l, avanzar } = nuevo();
    for (let i = 0; i < 3; i++) { expect(l.intento()).toEqual({ ok: true }); l.falla(); avanzar(1000); }
    expect(l.intento()).toEqual({ ok: false, reintentarEnSeg: 57 }); // la primera falla vence a los 60 s; pasaron 3
  });
  it("se libera solo cuando vence la falla más vieja (ventana deslizante)", () => {
    const { l, avanzar } = nuevo();
    l.falla(); avanzar(10_000); l.falla(); avanzar(10_000); l.falla();
    expect(l.intento().ok).toBe(false);
    avanzar(40_001);                                   // venció la primera
    expect(l.intento().ok).toBe(true);
  });
  it("un ingreso correcto limpia las fallas", () => {
    const { l } = nuevo();
    l.falla(); l.falla(); l.exito();
    l.falla(); l.falla();
    expect(l.intento().ok).toBe(true);
  });
  it("el tiempo de espera nunca es menor a 1 segundo", () => {
    const { l, avanzar } = nuevo();
    l.falla(); l.falla(); l.falla(); avanzar(59_999);
    expect(l.intento()).toEqual({ ok: false, reintentarEnSeg: 1 });
  });
});
