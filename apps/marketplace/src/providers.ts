import type {
  CanastaContacto, CatalogoItem, Cobro, Contacto, EvidenciaMercado, Existencia, Interaccion,
  Oportunidad, ParComplementario, ProviderRegistry, RespuestaFeedback, ResumenContacto, ResumenItem,
  TenantCtx,
} from "@agent-core/contracts";

// Adapter de un MARKETPLACE de dos lados. Mapea el dominio al modelo canónico:
//   comprador/vendedor → Contacto (roles), mensajería → Interaccion, orden → Transaccion,
//   liquidación/comisión → Cobro, publicación → CatalogoItem, stock → Existencia,
//   carrito abandonado / lead → Oportunidad, precio de otro vendedor → EvidenciaMercado,
//   reseña/rating → RespuestaFeedback.
// Cadencia: "transaccional_repetitivo" (compra repetida). Tenant = un VENDEDOR: cada
// vendedor tiene su equipo IA sobre SUS compradores/órdenes/stock, aislado del resto.
// Expone solo estas capacidades: contacts, transactions, receivables, catalog, inventory,
// pipeline, competition, feedback (sin agenda, logistics, suppliers, production, etc.).

const HOY = "2026-09-14T12:00:00.000Z";
const TENANT = "vendedor1";

interface DatosTenant {
  contactos: Contacto[];
  interacciones: Interaccion[];
  resumenContactos: ResumenContacto[];
  pares: ParComplementario[];
  canastas: CanastaContacto[];
  rentabilidad: ResumenItem[];
  cobros: Cobro[];
  catalogo: CatalogoItem[];
  existencias: Existencia[];
  oportunidades: Oportunidad[];
  mercado: EvidenciaMercado[];
  resenas: RespuestaFeedback[];
}

const DEMO: DatosTenant = {
  contactos: [
    { id: "b1", tenantId: TENANT, creadoEn: HOY, nombre: "Ana", roles: ["comprador"] },
    { id: "b2", tenantId: TENANT, creadoEn: HOY, nombre: "Beto", roles: ["comprador"] },
  ],
  interacciones: [
    { id: "m1", tenantId: TENANT, creadoEn: HOY, contactoId: "b1", canal: "whatsapp", direccion: "entrante", texto: "quiero comprar 3 remeras", fecha: HOY },      // pedido
    { id: "m2", tenantId: TENANT, creadoEn: HOY, contactoId: "b2", canal: "whatsapp", direccion: "entrante", texto: "el producto llegó fallado, quiero devolución", fecha: HOY }, // reclamo
  ],
  resumenContactos: [
    // b1: comprador valioso que se pasó de su frecuencia → reactivación + riesgo de abandono.
    { contactoId: "b1", compras: 6, totalGastado: 300_000, ticketPromedio: 50_000, ultimaTransaccion: "2026-05-15T00:00:00.000Z", diasDesdeUltima: 122, frecuenciaDias: 30 },
    { contactoId: "b2", compras: 3, totalGastado: 60_000, ticketPromedio: 20_000, ultimaTransaccion: HOY, diasDesdeUltima: 4, frecuenciaDias: 30 },
  ],
  pares: [{ itemA: "remera", itemB: "gorra", nombreA: "Remera", nombreB: "Gorra", coOcurrencias: 6 }],
  canastas: [{ contactoId: "b1", nombre: "Ana", itemIds: ["remera"] }], // tiene remera, le falta gorra
  rentabilidad: [
    { catalogoItemId: "p1", nombre: "Remera", precio: 5000, costo: 4600, margenPct: 8, ventas30d: 25, stock: 3, valorInmovilizado: 0 },       // margen bajo
    { catalogoItemId: "p2", nombre: "Buzo", precio: 15000, costo: 9000, margenPct: 40, ventas30d: 0, stock: 40, valorInmovilizado: 360_000 }, // inmovilizado
  ],
  cobros: [
    // Liquidaciones del marketplace al vendedor (receivables desde su lado).
    { id: "liq1", tenantId: TENANT, creadoEn: HOY, contactoId: "b1", estado: "vencido", monto: 120_000, moneda: "ARS", venceEn: "2026-08-01T00:00:00.000Z" }, // vencida
    { id: "liq2", tenantId: TENANT, creadoEn: HOY, contactoId: "b2", estado: "pendiente", monto: 8_000, moneda: "ARS", venceEn: "2026-12-01T00:00:00.000Z" },
    { id: "liq3", tenantId: TENANT, creadoEn: HOY, contactoId: "b1", estado: "pendiente", monto: 40_000, moneda: "ARS", venceEn: "2026-09-16T00:00:00.000Z" }, // por vencer
  ],
  catalogo: [
    { id: "p1", tenantId: TENANT, creadoEn: HOY, nombre: "Remera", precio: 5000, costo: 4600 },
    { id: "p2", tenantId: TENANT, creadoEn: HOY, nombre: "Buzo", precio: 15000, costo: 9000 },
  ],
  existencias: [
    { id: "ex1", tenantId: TENANT, creadoEn: HOY, catalogoItemId: "p1", cantidad: 3, minimo: 10 }, // bajo stock
    { id: "ex2", tenantId: TENANT, creadoEn: HOY, catalogoItemId: "p2", cantidad: 40, minimo: 5 },
  ],
  oportunidades: [
    // Carrito abandonado (lead vencido) → seguimiento; lead abierto → venta.
    { id: "op1", tenantId: TENANT, creadoEn: HOY, contactoId: "b1", etapa: "carrito", titulo: "Carrito abandonado (Remera x3)", valorEstimado: 15_000, cierreEstimado: "2026-09-05T00:00:00.000Z" },
    { id: "op2", tenantId: TENANT, creadoEn: HOY, contactoId: "b2", etapa: "negociacion", titulo: "Consulta por Buzo", valorEstimado: 30_000, cierreEstimado: "2026-12-01T00:00:00.000Z" },
  ],
  mercado: [
    // p1: otro vendedor lo tiene más barato → estamos por encima; hay margen para ajustar.
    { id: "mk1", tenantId: TENANT, creadoEn: HOY, fuente: "otro_vendedor", refEntidad: { tipo: "catalogo_item", id: "p1" }, precio: 3800, moneda: "ARS", observadoEn: HOY },
    { id: "mk2", tenantId: TENANT, creadoEn: HOY, fuente: "otro_vendedor", refEntidad: { tipo: "catalogo_item", id: "p2" }, precio: 15200, moneda: "ARS", observadoEn: HOY },
  ],
  resenas: [
    { id: "r1", tenantId: TENANT, creadoEn: HOY, contactoId: "b1", puntaje: 10, tipo: "nps", respondidoEn: HOY }, // promotor
    { id: "r2", tenantId: TENANT, creadoEn: HOY, contactoId: "b2", puntaje: 3, tipo: "nps", comentario: "el producto llegó fallado", respondidoEn: HOY }, // detractor
  ],
};

const DATOS: Record<string, DatosTenant> = { [TENANT]: DEMO };
const vacio: DatosTenant = {
  contactos: [], interacciones: [], resumenContactos: [], pares: [], canastas: [], rentabilidad: [],
  cobros: [], catalogo: [], existencias: [], oportunidades: [], mercado: [], resenas: [],
};
const datos = (ctx: TenantCtx): DatosTenant => DATOS[ctx.tenantId] ?? vacio;

/** ProviderRegistry del marketplace (visto por un vendedor). */
export function crearProviders(): ProviderRegistry {
  return {
    contacts: {
      async list(ctx) { return { items: datos(ctx).contactos }; },
      async get(ctx, id) { return datos(ctx).contactos.find((c) => c.id === id) ?? null; },
      async history(ctx, contactoId) {
        return { items: datos(ctx).interacciones.filter((i) => i.contactoId === contactoId) };
      },
    },
    interactions: {
      async pending(ctx) { return { items: datos(ctx).interacciones }; },
      async byContact(ctx, contactoId) {
        return { items: datos(ctx).interacciones.filter((i) => i.contactoId === contactoId) };
      },
    },
    transactions: {
      async byContact() { return { items: [] }; },
      async recent() { return { items: [] }; },
      async resumenPorContacto(ctx) { return { items: datos(ctx).resumenContactos }; },
      async paresComplementarios(ctx) { return datos(ctx).pares; },
      async canastasPorContacto(ctx) { return { items: datos(ctx).canastas }; },
    },
    receivables: {
      async pending(ctx) {
        return { items: datos(ctx).cobros.filter((c) => c.estado !== "cobrado" && c.estado !== "incobrable") };
      },
      async overdue(ctx) {
        return { items: datos(ctx).cobros.filter((c) => !!c.venceEn && c.venceEn < HOY) };
      },
    },
    catalog: {
      async items(ctx) { return { items: datos(ctx).catalogo }; },
      async get(ctx, id) { return datos(ctx).catalogo.find((i) => i.id === id) ?? null; },
      async resumenRentabilidad(ctx) { return { items: datos(ctx).rentabilidad }; },
    },
    inventory: {
      async stock(ctx) { return { items: datos(ctx).existencias }; },
      async lowStock(ctx) {
        return { items: datos(ctx).existencias.filter((e) => e.cantidad <= 0 || (e.minimo != null && e.cantidad <= e.minimo)) };
      },
    },
    pipeline: {
      async open(ctx) { return { items: datos(ctx).oportunidades }; },
      async byContact(ctx, contactoId) {
        return { items: datos(ctx).oportunidades.filter((o) => o.contactoId === contactoId) };
      },
    },
    competition: {
      async marketEvidence(ctx) { return { items: datos(ctx).mercado }; },
    },
    feedback: {
      async responses(ctx) { return { items: datos(ctx).resenas }; },
    },
  };
}
