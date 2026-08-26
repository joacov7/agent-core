import type {
  CanastaContacto, Contacto, Interaccion, ParComplementario, ProviderRegistry,
  ResumenContacto, ResumenItem, TenantCtx,
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
};

const DATOS: Record<string, DatosTenant> = { demo: DEMO };
const vacio: DatosTenant = { contactos: [], interacciones: [], resumenContactos: [], pares: [], canastas: [], rentabilidad: [] };
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
  };
}
