// ─── Venta cruzada: lógica pura (sin DB) ─────────────────────────────────────
// Cruza los pares complementarios (canasta) con lo que cada cliente ya compró y
// sugiere el producto complementario que le falta. Determinístico; la confianza
// sale del soporte (cuántas veces se compraron juntos). No inventa causalidad.

export interface ParComplementario {
  a: string; b: string; nombre_a: string | null; nombre_b: string | null; co: number;
}
export interface ClienteProductos { email: string; nombre: string; productos: string[] }

export interface OportunidadCruzada {
  email: string; nombre: string;
  tiene: string;            // producto que el cliente SÍ compró
  sugerido: string;         // producto complementario que le falta
  sugerido_nombre: string | null;
  co: number;               // co-ocurrencias del par
  confianza: number;        // 0-100 según soporte
}

// Confianza por soporte (co-ocurrencias). Documentado y conservador.
export function confianzaPorSoporte(co: number): number {
  if (co >= 5) return 80;
  if (co >= 3) return 65;
  return 50; // co === 2 (mínimo aceptado)
}

// Genera oportunidades de venta cruzada. Para cada cliente: si compró un lado de
// un par fuerte y NO el otro, sugiere el que falta. Dedup por (cliente, sugerido),
// quedándose con el de mayor co-ocurrencia. Tope por cliente para no hacer ruido.
export function detectarVentaCruzada(
  pares: ParComplementario[],
  clientes: ClienteProductos[],
  opts: { maxPorCliente?: number } = {}
): OportunidadCruzada[] {
  const maxPorCliente = opts.maxPorCliente ?? 3;
  const out: OportunidadCruzada[] = [];

  for (const c of clientes) {
    const tiene = new Set(c.productos);
    const mejores = new Map<string, OportunidadCruzada>(); // sugerido → mejor oportunidad

    for (const par of pares) {
      let tieneLado: string | null = null, sugerido: string | null = null, sugeridoNombre: string | null = null;
      if (tiene.has(par.a) && !tiene.has(par.b)) { tieneLado = par.a; sugerido = par.b; sugeridoNombre = par.nombre_b; }
      else if (tiene.has(par.b) && !tiene.has(par.a)) { tieneLado = par.b; sugerido = par.a; sugeridoNombre = par.nombre_a; }
      if (!sugerido) continue;

      const prev = mejores.get(sugerido);
      if (!prev || par.co > prev.co) {
        mejores.set(sugerido, {
          email: c.email, nombre: c.nombre, tiene: tieneLado!, sugerido,
          sugerido_nombre: sugeridoNombre, co: par.co, confianza: confianzaPorSoporte(par.co),
        });
      }
    }

    out.push(...[...mejores.values()].sort((x, y) => y.co - x.co).slice(0, maxPorCliente));
  }

  return out.sort((x, y) => y.co - x.co);
}
