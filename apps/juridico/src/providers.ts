import type {
  Cobro, Contacto, Documento, Evento, Interaccion, Oportunidad, ProviderRegistry, TenantCtx,
} from "@agent-core/contracts";

// Adapter de un estudio jurídico. Mapea el dominio legal al modelo canónico
// (sección 10 del documento): comitente→Contacto, honorario→Cobro, audiencia/plazo→
// Evento, escrito→Documento, consulta→Oportunidad. Cadencia: "proyecto".
// Solo expone las capacidades que el estudio realmente tiene: sin transactions,
// catalog, inventory, suppliers, competition, logistics ni production.

const HOY = "2026-08-25T12:00:00.000Z";

interface DatosTenant {
  comitentes: Contacto[];
  interacciones: Interaccion[];
  honorarios: Cobro[];
  audiencias: Evento[];
  escritos: Documento[];
  consultas: Oportunidad[];
}

const DEMO: DatosTenant = {
  comitentes: [
    { id: "com1", tenantId: "estudio", creadoEn: HOY, nombre: "González S.A.", roles: ["comitente"] },
    { id: "com2", tenantId: "estudio", creadoEn: HOY, nombre: "Pérez, Juan", roles: ["comitente"] },
  ],
  interacciones: [
    { id: "int1", tenantId: "estudio", creadoEn: HOY, contactoId: "com2", canal: "whatsapp", direccion: "entrante", texto: "consulta por el estado del expediente, urgente", fecha: HOY },
  ],
  honorarios: [
    { id: "hon1", tenantId: "estudio", creadoEn: HOY, contactoId: "com1", estado: "vencido", monto: 450_000, moneda: "ARS", venceEn: "2026-06-15T00:00:00.000Z" }, // vencido
    { id: "hon2", tenantId: "estudio", creadoEn: HOY, contactoId: "com2", estado: "pendiente", monto: 120_000, moneda: "ARS", venceEn: "2026-10-01T00:00:00.000Z" },
  ],
  audiencias: [
    { id: "aud1", tenantId: "estudio", creadoEn: HOY, tipo: "audiencia", titulo: "Audiencia preliminar — Expte. 1234/25", inicia: "2026-08-20T00:00:00.000Z", refEntidad: { tipo: "expediente", id: "exp1234" } }, // plazo pasado
    { id: "aud2", tenantId: "estudio", creadoEn: HOY, tipo: "plazo", titulo: "Vencimiento traslado — Expte. 5678/25", inicia: "2026-11-01T00:00:00.000Z" },
  ],
  escritos: [
    { id: "esc1", tenantId: "estudio", creadoEn: HOY, tipo: "escrito", titulo: "Contestación de demanda — Expte. 1234/25", refEntidad: { tipo: "expediente", id: "exp1234" } },
  ],
  consultas: [
    { id: "con1", tenantId: "estudio", creadoEn: HOY, contactoId: "com2", etapa: "consulta", titulo: "Consulta laboral — posible juicio", valorEstimado: 800_000, cierreEstimado: "2026-08-10T00:00:00.000Z" }, // sin cerrar (vencida)
  ],
};

const DATOS: Record<string, DatosTenant> = { estudio: DEMO };
const vacio: DatosTenant = { comitentes: [], interacciones: [], honorarios: [], audiencias: [], escritos: [], consultas: [] };
const datos = (ctx: TenantCtx): DatosTenant => DATOS[ctx.tenantId] ?? vacio;

/** ProviderRegistry del estudio: contacts, receivables, agenda, documents, pipeline. */
export function crearProviders(): ProviderRegistry {
  return {
    contacts: {
      async list(ctx) { return { items: datos(ctx).comitentes }; },
      async get(ctx, id) { return datos(ctx).comitentes.find((c) => c.id === id) ?? null; },
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
    receivables: {
      async pending(ctx) {
        return { items: datos(ctx).honorarios.filter((c) => c.estado !== "cobrado" && c.estado !== "incobrable") };
      },
      async overdue(ctx) {
        return { items: datos(ctx).honorarios.filter((c) => !!c.venceEn && c.venceEn < HOY) };
      },
    },
    agenda: {
      async upcoming(ctx) { return { items: datos(ctx).audiencias }; },
    },
    documents: {
      async list(ctx) { return { items: datos(ctx).escritos }; },
      async get(ctx, id) { return datos(ctx).escritos.find((d) => d.id === id) ?? null; },
    },
    pipeline: {
      async open(ctx) { return { items: datos(ctx).consultas }; },
      async byContact(ctx, contactoId) {
        return { items: datos(ctx).consultas.filter((o) => o.contactoId === contactoId) };
      },
    },
  };
}
