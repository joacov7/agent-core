// ─── WhatsApp inteligente: clasificación + intención (lógica pura, sin IA) ────
// Clasifica una conversación y estima la intención de compra (0-100) por reglas
// sobre el texto. Determinístico: la IA queda para redactar la respuesta, no para
// puntuar. No inventa: si el texto no da señales, la intención es baja.

export type TipoConversacion =
  | "reclamo" | "pedido" | "negociacion" | "precio" | "postventa"
  | "proveedor" | "seguimiento" | "consulta";

const REGLAS: { tipo: TipoConversacion; re: RegExp }[] = [
  { tipo: "reclamo", re: /reclamo|no funciona|no anda|roto|fallado|defectuoso|queja|devoluci[oó]n|devolver|est[aá] mal|problema con/i },
  { tipo: "pedido", re: /quiero (comprar|llevar|pedir)|me llevo|hacer un pedido|hacer el pedido|confirmo el pedido|comprar[ií]a|lo compro/i },
  { tipo: "negociacion", re: /descuento|rebaja|mejor precio|hac[eé]s precio|me haces|oferta|promoci[oó]n|contado/i },
  { tipo: "precio", re: /precio|cu[aá]nto (sale|cuesta|vale|es)|cotiza|presupuesto|valor/i },
  { tipo: "postventa", re: /garant[ií]a|factura|cambio|c[oó]mo (uso|funciona)|instruccion|reembolso/i },
  { tipo: "proveedor", re: /soy proveedor|te vendo|te ofrezco|distribuidor|represent|mayorista te/i },
  { tipo: "seguimiento", re: /qued[oó] pendiente|te escrib[ií]|hab[ií]amos hablado|el otro d[ií]a|seguimos/i },
];

export function clasificarConversacion(texto: string): TipoConversacion {
  const t = (texto ?? "").toString();
  for (const r of REGLAS) if (r.re.test(t)) return r.tipo;
  return "consulta";
}

const SUMA: { re: RegExp; pts: number }[] = [
  { re: /quiero (comprar|llevar)|me llevo|lo compro|hacer (un|el) pedido|confirmo/i, pts: 40 },
  { re: /precio|cu[aá]nto (sale|cuesta|vale)|cotiza|presupuesto/i, pts: 25 },
  { re: /ten[eé]s (stock|disponible)|hay stock|disponibilidad|entrega/i, pts: 15 },
  { re: /\b\d+\s*(unidades|u|kg|kilos|cajas|docenas|pack)/i, pts: 15 },
  { re: /\b(hoy|ya|urgente|ahora|cuanto antes)\b/i, pts: 10 },
];
const RESTA: { re: RegExp; pts: number }[] = [
  { re: /solo (consulta|preguntaba|mirando)|estoy mirando|m[aá]s adelante|despu[eé]s veo|por las dudas/i, pts: 25 },
  { re: /reclamo|no funciona|devoluci[oó]n|problema con|queja/i, pts: 40 },
];

// Intención de compra 0-100. Suma señales positivas, resta negativas. Clamp.
export function intencionCompra(texto: string): number {
  const t = (texto ?? "").toString();
  let s = 0;
  for (const x of SUMA) if (x.re.test(t)) s += x.pts;
  for (const x of RESTA) if (x.re.test(t)) s -= x.pts;
  return Math.max(0, Math.min(100, s));
}

export interface ConversacionAnalizada {
  wa_id: string;
  texto: string;
  tipo: TipoConversacion;
  intencion: number;
}

export function analizarConversacion(wa_id: string, texto: string): ConversacionAnalizada {
  return { wa_id, texto, tipo: clasificarConversacion(texto), intencion: intencionCompra(texto) };
}

// Umbral por defecto para considerar "alta intención" (prioriza la respuesta).
export const INTENCION_ALTA = 50;
