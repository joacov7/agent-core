/**
 * Freno a los intentos fallidos de ingreso. Es GLOBAL (no por IP): sin un proxy de confianza delante, la IP de origen
 * se puede falsear con un encabezado, y un límite por IP no frenaría a nadie. Con un solo usuario, el costo es que
 * un atacante que acierta a insistir bloquea los ingresos de todos por unos minutos, pero no puede probar claves a
 * más de `max` por ventana, que es lo que importa. Puro: el reloj se inyecta para testearlo.
 */
export interface Limitador {
  /** ¿Se puede intentar ahora? Si no, en cuántos segundos se libera el primer cupo. */
  intento(): { ok: true } | { ok: false; reintentarEnSeg: number };
  falla(): void;
  /** Un ingreso correcto limpia las fallas. */
  exito(): void;
}

export function crearLimitador(opts: { max: number; ventanaMs: number; ahora?: () => number }): Limitador {
  const { max, ventanaMs, ahora = Date.now } = opts;
  let fallas: number[] = [];
  const vigentes = () => { const t = ahora(); fallas = fallas.filter((f) => t - f < ventanaMs); return fallas; };
  return {
    intento() {
      const v = vigentes();
      if (v.length < max) return { ok: true };
      return { ok: false, reintentarEnSeg: Math.max(1, Math.ceil((v[0]! + ventanaMs - ahora()) / 1000)) };
    },
    falla() { vigentes(); fallas.push(ahora()); },
    exito() { fallas = []; },
  };
}
