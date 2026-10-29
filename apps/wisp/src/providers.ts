import type { BusinessModel, ID, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { pagina, soloLectura, ventana, type Queryable } from "./db.js";
import { CADENCIA_WISP, cobro, contacto, hoyLocal, incidente, resumenContacto, transaccion } from "./mappers.js";

/** Tipo de negocio de un WISP: abonos recurrentes. */
export const MODELO_NEGOCIO_WISP: BusinessModel = CADENCIA_WISP;

export interface OpcionesWisp {
  /** Conexión a la base de guaynet (idealmente con el rol de `sql/solo-lectura.sql`). */
  db: Queryable;
  /** Un WISP = un tenant. Cualquier otro tenant recibe vacío (falla cerrado). */
  tenantId: string;
  moneda?: string;
  /** Zona horaria del negocio para "hoy" y los vencimientos. */
  zona?: string;
}

// Todo SELECT, parametrizado ($n). Las fechas `date` se castean a texto (YYYY-MM-DD) para no
// depender de la zona horaria del servidor. No se leen DNI/CUIT/domicilio/IP/MAC ni `users`.

const CONTACTOS = `
  SELECT c.id::text AS id, c.first_name, c.last_name, c.phone, c.email, c.status::text AS status,
         c.created_at, c.updated_at
  FROM clients c
  WHERE c.status <> 'cancelled'
    AND ($1::text IS NULL OR strpos(lower(c.first_name || ' ' || c.last_name), lower($1)) > 0)
  ORDER BY c.id
  LIMIT $2 OFFSET $3`;

const CONTACTO = `
  SELECT c.id::text AS id, c.first_name, c.last_name, c.phone, c.email, c.status::text AS status,
         c.created_at, c.updated_at
  FROM clients c
  WHERE c.id = $1::int AND c.status <> 'cancelled'`;

// Facturas con saldo. "vencido" = marcada overdue O con fecha vencida aunque guaynet todavía no
// la haya marcado (la tarea de Celery corre una vez por día). "parcial" = pagó una parte.
const COBROS = `
  WITH f AS (
    SELECT i.id, i.client_id, i.period, i.amount, i.due_date, i.created_at,
           COALESCE(p.pagado, 0) AS pagado,
           CASE WHEN i.status = 'overdue' OR i.due_date < $1::date THEN 'vencido'
                WHEN COALESCE(p.pagado, 0) > 0 THEN 'parcial'
                ELSE 'pendiente' END AS estado
    FROM invoices i
    LEFT JOIN (SELECT invoice_id, SUM(amount) AS pagado FROM payments GROUP BY invoice_id) p
      ON p.invoice_id = i.id
    WHERE i.status IN ('pending', 'overdue') AND i.amount - COALESCE(p.pagado, 0) > 0
  )
  SELECT f.id::text AS id, f.client_id::text AS contacto_id, f.period, f.amount, f.pagado,
         f.due_date::text AS due_date, f.estado, f.created_at
  FROM f
  WHERE f.estado = ANY($2::text[])
  ORDER BY f.due_date, f.id
  LIMIT $3 OFFSET $4`;

const FACTURAS_BASE = `
  SELECT i.id::text AS id, i.client_id::text AS contacto_id, i.period, i.amount, i.status::text AS status,
         i.issue_date::text AS issue_date, i.paid_date::text AS paid_date, i.created_at
  FROM invoices i
  WHERE i.status <> 'draft'`;

const TX_POR_CONTACTO = `${FACTURAS_BASE} AND i.client_id = $1::int ORDER BY i.issue_date DESC, i.id DESC LIMIT $2 OFFSET $3`;
const TX_RECIENTES = `${FACTURAS_BASE} ORDER BY i.issue_date DESC, i.id DESC LIMIT $1 OFFSET $2`;

// La "compra" de un abono es la factura PAGADA: de ahí salen frecuencia (≈30 días) y recencia.
const RESUMEN = `
  SELECT c.id::text AS contacto_id, COUNT(i.id) AS compras, COALESCE(SUM(i.amount), 0) AS total,
         MAX(i.paid_date)::text AS ultima_fecha, MIN(i.paid_date)::text AS primera_fecha
  FROM clients c
  JOIN invoices i ON i.client_id = c.id AND i.status = 'paid' AND i.paid_date IS NOT NULL
  WHERE c.status <> 'cancelled'
  GROUP BY c.id
  ORDER BY c.id
  LIMIT $1 OFFSET $2`;

const ROUTERS_CAIDOS = `
  SELECT r.id::text AS id, r.name, r.location, r.last_seen,
         (SELECT COUNT(*) FROM clients c WHERE c.router_id = r.id AND c.status = 'active') AS afectados
  FROM mikrotik_routers r
  WHERE r.status = 'offline'
  ORDER BY r.id`;

const EQUIPOS_CAIDOS = `
  SELECT u.id::text AS id, u.name, u.location, u.last_seen, u.device_type::text AS device_type,
         (SELECT COUNT(*) FROM clients c WHERE c.ubiquiti_device_id = u.id AND c.status = 'active') AS afectados
  FROM ubiquiti_devices u
  WHERE u.status = 'offline'
  ORDER BY u.id`;

/**
 * Providers de un WISP sobre la base de guaynet. Capacidades que expone: `contacts`,
 * `transactions`, `receivables` e `incidents`. No expone `catalog` (los planes no alimentan a
 * ningún agente y activaría Rentabilidad sin datos de costo) ni lo que guaynet no tiene
 * (agenda, personal, NPS, inventario): esos agentes quedan apagados solos.
 */
export function crearProvidersWisp(opts: OpcionesWisp): ProviderRegistry {
  const db = soloLectura(opts.db);
  const { tenantId } = opts;
  const moneda = opts.moneda ?? "ARS";
  const zona = opts.zona ?? "America/Argentina/Buenos_Aires";

  const ahora = (ctx: TenantCtx) => ctx.now?.() ?? new Date();
  const hoy = (ctx: TenantCtx) => hoyLocal(ahora(ctx), zona);
  // Multi-tenancy: este adapter sirve a UN tenant; cualquier otro ve vacío, nunca datos ajenos.
  const propio = (ctx: TenantCtx) => ctx.tenantId === tenantId;
  const esId = (id: ID) => /^\d+$/.test(id);

  async function cobros(ctx: TenantCtx, estados: string[], q?: Parameters<typeof ventana>[0]) {
    if (!propio(ctx)) return { items: [] };
    const v = ventana(q);
    const { rows } = await db.query(COBROS, [hoy(ctx), estados, v.limit + 1, v.offset]);
    return pagina(rows.map((f) => cobro(f, tenantId, moneda)), v);
  }

  return {
    contacts: {
      async list(ctx, q) {
        if (!propio(ctx)) return { items: [] };
        const v = ventana(q);
        const { rows } = await db.query(CONTACTOS, [q?.q?.trim() || null, v.limit + 1, v.offset]);
        return pagina(rows.map((f) => contacto(f, tenantId)), v);
      },
      async get(ctx, id) {
        if (!propio(ctx) || !esId(id)) return null;
        const { rows } = await db.query(CONTACTO, [id]);
        return rows[0] ? contacto(rows[0], tenantId) : null;
      },
      // guaynet no registra interacciones (llamados, mensajes): historial vacío.
      async history() { return { items: [] }; },
    },

    receivables: {
      pending: (ctx, q) => cobros(ctx, ["pendiente", "parcial"], q),
      overdue: (ctx, q) => cobros(ctx, ["vencido"], q),
    },

    transactions: {
      async byContact(ctx, contactoId, q) {
        if (!propio(ctx) || !esId(contactoId)) return { items: [] };
        const v = ventana(q);
        const { rows } = await db.query(TX_POR_CONTACTO, [contactoId, v.limit + 1, v.offset]);
        return pagina(rows.map((f) => transaccion(f, tenantId, moneda)), v);
      },
      async recent(ctx, q) {
        if (!propio(ctx)) return { items: [] };
        const v = ventana(q);
        const { rows } = await db.query(TX_RECIENTES, [v.limit + 1, v.offset]);
        return pagina(rows.map((f) => transaccion(f, tenantId, moneda)), v);
      },
      async resumenPorContacto(ctx, q) {
        if (!propio(ctx)) return { items: [] };
        const v = ventana(q);
        const { rows } = await db.query(RESUMEN, [v.limit + 1, v.offset]);
        const dia = hoy(ctx);
        const items = rows.flatMap((f) => resumenContacto(f, dia) ?? []);
        return pagina(items, v);
      },
    },

    incidents: {
      async open(ctx) {
        if (!propio(ctx)) return { items: [] };
        const [routers, equipos] = await Promise.all([db.query(ROUTERS_CAIDOS), db.query(EQUIPOS_CAIDOS)]);
        const t = ahora(ctx);
        const items = [
          ...routers.rows.map((f) => incidente(f, tenantId, t, "mikrotik")),
          ...equipos.rows.map((f) => incidente(f, tenantId, t, "ubiquiti")),
        ].sort((a, b) => (b.usuariosAfectados ?? 0) - (a.usuariosAfectados ?? 0));
        return { items };
      },
    },
  };
}
