import type {
  CanastaContacto, Cobro, Compra, Contacto, Evento, Existencia, Interaccion, Oportunidad,
  ParComplementario, ProviderRegistry, ResumenContacto, ResumenItem, TenantCtx,
} from "@agent-core/contracts";

// Dataset de referencia por tenant. El tenant "demo" tiene datos; los demás, nada
// (los providers filtran por ctx.tenantId: segunda barrera de aislamiento).
interface DatosTenant {
  contactos: Contacto[];
  interacciones: Interaccion[];
  resumenContactos: ResumenContacto[];
  pares: ParComplementario[];
  canastas: CanastaContacto[];
  rentabilidad: ResumenItem[];
  cobros: Cobro[];
  eventos: Evento[];
  existencias: Existencia[];
  compras: Compra[];
  oportunidades: Oportunidad[];
}

const HOY = "2026-08-25T12:00:00.000Z";
function contacto(id: string, nombre: string): Contacto {
  return { id, tenantId: "demo", creadoEn: HOY, nombre };
}
function interaccion(id: string, contactoId: string, texto: string): Interaccion {
  return { id, tenantId: "demo", creadoEn: HOY, contactoId, canal: "whatsapp", direccion: "entrante", texto, fecha: HOY };
}

const DEMO: DatosTenant = {
  contactos: [contacto("c1", "Ana"), contacto("c2", "Beto")],
  interacciones: [
    interaccion("i1", "c1", "hola, quiero comprar 3 mates"),          // pedido, alta intención
    interaccion("i2", "c2", "el mate llegó roto, quiero devolución"), // reclamo
  ],
  resumenContactos: [
    // c1: cliente valioso que se pasó de su frecuencia → riesgo alto → reactivar.
    { contactoId: "c1", compras: 6, totalGastado: 1_000_000, ticketPromedio: 166_666, ultimaTransaccion: "2026-04-01T00:00:00.000Z", diasDesdeUltima: 120, frecuenciaDias: 30 },
    // c2: al día.
    { contactoId: "c2", compras: 4, totalGastado: 200_000, ticketPromedio: 50_000, ultimaTransaccion: HOY, diasDesdeUltima: 5, frecuenciaDias: 30 },
  ],
  pares: [{ itemA: "mate", itemB: "bombilla", nombreA: "Mate", nombreB: "Bombilla", coOcurrencias: 6 }],
  canastas: [{ contactoId: "c1", nombre: "Ana", itemIds: ["mate"] }], // tiene mate, le falta bombilla
  rentabilidad: [
    { catalogoItemId: "p1", nombre: "Mate", precio: 1000, costo: 900, margenPct: 10, ventas30d: 20, stock: 5, valorInmovilizado: 0 },
    { catalogoItemId: "p2", nombre: "Termo", precio: 5000, costo: 3000, margenPct: 40, ventas30d: 0, stock: 40, valorInmovilizado: 200_000 },
  ],
  cobros: [
    { id: "cob1", tenantId: "demo", creadoEn: HOY, contactoId: "c1", estado: "vencido", monto: 150_000, moneda: "ARS", venceEn: "2026-07-01T00:00:00.000Z" },
    { id: "cob2", tenantId: "demo", creadoEn: HOY, contactoId: "c2", estado: "pendiente", monto: 5_000, moneda: "ARS", venceEn: "2026-12-01T00:00:00.000Z" },
  ],
  eventos: [
    { id: "ev1", tenantId: "demo", creadoEn: HOY, tipo: "vencimiento", titulo: "Vencimiento AFIP", inicia: "2026-08-20T00:00:00.000Z" },
    { id: "ev2", tenantId: "demo", creadoEn: HOY, tipo: "turno", titulo: "Reunión Q4", inicia: "2026-11-01T00:00:00.000Z" },
  ],
  existencias: [
    { id: "ex1", tenantId: "demo", creadoEn: HOY, catalogoItemId: "p1", cantidad: 2, minimo: 5 },
    { id: "ex2", tenantId: "demo", creadoEn: HOY, catalogoItemId: "p2", cantidad: 50, minimo: 5 },
  ],
  compras: [
    // Egreso a ~11 días → ventana 8-30. Supera al ingreso de esa ventana → déficit.
    { id: "compra1", tenantId: "demo", creadoEn: HOY, proveedorId: "prov1", estado: "pendiente", monto: 80_000, moneda: "ARS", fecha: "2026-09-05T00:00:00.000Z" },
  ],
  oportunidades: [
    { id: "op1", tenantId: "demo", creadoEn: HOY, contactoId: "c1", etapa: "propuesta", titulo: "Presupuesto pintura", valorEstimado: 300_000, cierreEstimado: "2026-08-10T00:00:00.000Z" }, // vencida
    { id: "op2", tenantId: "demo", creadoEn: HOY, contactoId: "c2", etapa: "negociacion", titulo: "Ampliación", valorEstimado: 500_000, cierreEstimado: "2026-12-01T00:00:00.000Z" }, // cómoda
  ],
};

const DATOS: Record<string, DatosTenant> = { demo: DEMO };
const vacio: DatosTenant = {
  contactos: [], interacciones: [], resumenContactos: [], pares: [], canastas: [],
  rentabilidad: [], cobros: [], eventos: [], existencias: [], compras: [], oportunidades: [],
};
const datos = (ctx: TenantCtx): DatosTenant => DATOS[ctx.tenantId] ?? vacio;

/** ProviderRegistry in-memory. Expone contacts, transactions (+agregados) y catalog. */
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
    catalog: {
      async items(ctx) {
        return {
          items: datos(ctx).rentabilidad.map((r) => ({
            id: r.catalogoItemId, tenantId: ctx.tenantId, creadoEn: HOY, nombre: r.nombre, precio: r.precio,
            ...(r.costo != null ? { costo: r.costo } : {}),
          })),
        };
      },
      async get() { return null; },
      async resumenRentabilidad(ctx) { return { items: datos(ctx).rentabilidad }; },
    },
    receivables: {
      async pending(ctx) {
        return { items: datos(ctx).cobros.filter((c) => c.estado !== "cobrado" && c.estado !== "incobrable") };
      },
      async overdue(ctx) {
        return { items: datos(ctx).cobros.filter((c) => !!c.venceEn && c.venceEn < HOY) };
      },
    },
    agenda: {
      async upcoming(ctx) { return { items: datos(ctx).eventos }; },
    },
    inventory: {
      async stock(ctx) { return { items: datos(ctx).existencias }; },
      async lowStock(ctx) {
        return { items: datos(ctx).existencias.filter((e) => e.cantidad <= 0 || (e.minimo != null && e.cantidad <= e.minimo)) };
      },
    },
    suppliers: {
      async list(ctx) { return { items: datos(ctx).contactos.filter((c) => c.roles?.includes("proveedor")) }; },
      async purchases(ctx) { return { items: datos(ctx).compras }; },
    },
    pipeline: {
      async open(ctx) { return { items: datos(ctx).oportunidades }; },
      async byContact(ctx, contactoId) {
        return { items: datos(ctx).oportunidades.filter((o) => o.contactoId === contactoId) };
      },
    },
  };
}
