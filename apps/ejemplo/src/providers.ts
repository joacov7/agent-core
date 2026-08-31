import type {
  CanastaContacto, CatalogoItem, Cobro, Compra, Contacto, Evento, EvidenciaMercado, Existencia,
  Interaccion, Oportunidad, ParComplementario, ProviderRegistry, ResumenContacto, ResumenItem,
  SenalExterna, Tarea, TenantCtx,
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
  catalogo: CatalogoItem[];
  mercado: EvidenciaMercado[];
  entregas: Tarea[];
  procesos: Tarea[];
  senales: SenalExterna[];
}

const HOY = "2026-08-25T12:00:00.000Z";
function contacto(id: string, nombre: string): Contacto {
  return { id, tenantId: "demo", creadoEn: HOY, nombre };
}
function interaccion(id: string, contactoId: string, texto: string): Interaccion {
  return { id, tenantId: "demo", creadoEn: HOY, contactoId, canal: "whatsapp", direccion: "entrante", texto, fecha: HOY };
}

const DEMO: DatosTenant = {
  contactos: [contacto("c1", "Ana"), contacto("c2", "Beto"), { ...contacto("prov1", "Distribuidora Sur"), roles: ["proveedor"] }],
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
    // Por vencer en 2 días → lo toma Cobranza preventiva (no Cobros, que es vencido).
    { id: "cob3", tenantId: "demo", creadoEn: HOY, contactoId: "c2", estado: "pendiente", monto: 20_000, moneda: "ARS", venceEn: "2026-08-27T00:00:00.000Z" },
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
  catalogo: [
    { id: "p1", tenantId: "demo", creadoEn: HOY, nombre: "Mate", precio: 1200, costo: 600 },
    { id: "p2", tenantId: "demo", creadoEn: HOY, nombre: "Termo", precio: 5000, costo: 3000 },
  ],
  mercado: [
    // p1: estamos +33% vs mercado → caros; hay margen para bajar a 900.
    { id: "m1", tenantId: "demo", creadoEn: HOY, fuente: "scraper", refEntidad: { tipo: "catalogo_item", id: "p1" }, precio: 900, moneda: "ARS", observadoEn: HOY },
    // p2: en línea (~-2%).
    { id: "m2", tenantId: "demo", creadoEn: HOY, fuente: "scraper", refEntidad: { tipo: "catalogo_item", id: "p2" }, precio: 5100, moneda: "ARS", observadoEn: HOY },
  ],
  entregas: [
    { id: "ent1", tenantId: "demo", creadoEn: HOY, tipo: "entrega", titulo: "Entrega pedido #123", estado: "pendiente", venceEn: "2026-08-22T00:00:00.000Z" }, // demorada
    { id: "ent2", tenantId: "demo", creadoEn: HOY, tipo: "entrega", titulo: "Entrega pedido #124", estado: "completada", venceEn: "2026-08-24T00:00:00.000Z" },
  ],
  procesos: [
    { id: "proc1", tenantId: "demo", creadoEn: HOY, tipo: "faena", titulo: "Faena lote A", estado: "en_progreso", venceEn: "2026-08-24T00:00:00.000Z" }, // demorado
    { id: "proc2", tenantId: "demo", creadoEn: HOY, tipo: "mantenimiento", titulo: "Service equipo 3", estado: "pendiente", venceEn: "2026-09-10T00:00:00.000Z" },
  ],
  senales: [
    // Referido fuerte, no está en la base → prospecto top.
    { id: "s1", tenantId: "demo", creadoEn: HOY, fuente: "referido", nombre: "Carla Núñez", clave: "carla@nuevo.com", motivo: "la recomendó Ana", observadoEn: HOY },
    // Ana YA es contacto (email en la base a través del referido) → se descarta si coincide;
    // acá usamos una clave que sí está para probar el dedup contra la base.
    { id: "s2", tenantId: "demo", creadoEn: HOY, fuente: "marketplace", nombre: "Diego R.", clave: "diego@shop.com", score: 70, observadoEn: HOY },
    // Señal web floja → cae por debajo de la confianza mínima.
    { id: "s3", tenantId: "demo", creadoEn: HOY, fuente: "web", nombre: "Anónimo", clave: "anon@web.com", observadoEn: HOY },
  ],
};

const DATOS: Record<string, DatosTenant> = { demo: DEMO };
const vacio: DatosTenant = {
  contactos: [], interacciones: [], resumenContactos: [], pares: [], canastas: [],
  rentabilidad: [], cobros: [], eventos: [], existencias: [], compras: [], oportunidades: [],
  catalogo: [], mercado: [], entregas: [], procesos: [], senales: [],
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
      async items(ctx) { return { items: datos(ctx).catalogo }; },
      async get(ctx, id) { return datos(ctx).catalogo.find((i) => i.id === id) ?? null; },
      async resumenRentabilidad(ctx) { return { items: datos(ctx).rentabilidad }; },
    },
    competition: {
      async marketEvidence(ctx) { return { items: datos(ctx).mercado }; },
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
    logistics: {
      async deliveries(ctx) { return { items: datos(ctx).entregas }; },
    },
    production: {
      async processes(ctx) { return { items: datos(ctx).procesos }; },
    },
    externalSources: {
      async prospects(ctx) { return { items: datos(ctx).senales }; },
    },
  };
}
