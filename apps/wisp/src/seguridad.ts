import type { BusinessModel, ProviderRegistry, TenantCtx } from "@agent-core/contracts";
import { soloLectura, type Queryable } from "./db.js";
import { hoyLocal } from "./mappers.js";
import { incidenteAlerta, incidenteFalla, eventoVencimiento } from "./seguridad-mappers.js";

/** El servicio de monitoreo de alarmas también es de abonos recurrentes. */
export const MODELO_NEGOCIO_SEGURIDAD: BusinessModel = "suscripcion";

export interface OpcionesSeguridad {
  /** Conexión a la base de guaynet (rol de `sql/solo-lectura.sql` + `sql/solo-lectura-seguridad.sql`). */
  db: Queryable;
  /** La línea de seguridad es su propio tenant (distinto del de internet). Otro tenant ve vacío. */
  tenantId: string;
  zona?: string;
}

/** Ventana de la agenda: contratos vencidos hace ≤30 días (sin renovar) o por vencer en ≤60 días. */
const DIAS_ATRAS = 30;
const DIAS_ADELANTE = 60;
const DIAS_FALLAS = 30;

// Todo SELECT parametrizado. NUNCA se leen PINs, palabras seguras, tokens, ids de Telegram,
// domicilios ni coordenadas, notas, `raw_data` ni `user_code` (el rol de Postgres tampoco puede).
// Las suscripciones canceladas o pendientes de instalar no generan avisos.
const ALERTAS_ABIERTAS = `
  SELECT a.id::text AS id, a.alert_type, a.status, a.triggered_at, a.acknowledged_at, p.name AS titular
  FROM sec_alerts a
  JOIN sec_subscriptions s ON s.id = a.subscription_id
  JOIN sec_properties p ON p.id = s.property_id
  WHERE a.status IN ('new', 'acknowledged') AND s.status IN ('active', 'suspended')
  ORDER BY a.triggered_at, a.id`;

// Falla abierta = el ÚLTIMO evento de su familia (batería, energía, comunicación, sabotaje) es la
// falla y no su "restaurado". Solo se mira el último mes.
const FALLAS_ABIERTAS = `
  WITH e AS (
    SELECT id, subscription_id, occurred_at, event_type,
           CASE WHEN event_type IN ('battery_low', 'battery_restored') THEN 'bateria'
                WHEN event_type IN ('power_failure', 'power_restored') THEN 'energia'
                WHEN event_type IN ('communication_lost', 'communication_restored') THEN 'comunicacion'
                ELSE 'sabotaje' END AS familia
    FROM sec_events
    WHERE event_type IN ('battery_low', 'battery_restored', 'power_failure', 'power_restored',
                         'communication_lost', 'communication_restored', 'tamper', 'tamper_restored')
      AND occurred_at >= $1::timestamptz - make_interval(days => $2::int)
  ), ult AS (
    SELECT DISTINCT ON (subscription_id, familia) subscription_id, familia, event_type, occurred_at
    FROM e ORDER BY subscription_id, familia, occurred_at DESC, id DESC
  )
  SELECT u.subscription_id::text AS subscription_id, u.familia, u.occurred_at, p.name AS titular
  FROM ult u
  JOIN sec_subscriptions s ON s.id = u.subscription_id
  JOIN sec_properties p ON p.id = s.property_id
  WHERE u.event_type IN ('battery_low', 'power_failure', 'communication_lost', 'tamper')
    AND s.status IN ('active', 'suspended')
  ORDER BY u.occurred_at, u.subscription_id`;

const CONTRATOS = `
  SELECT s.id::text AS id, s.contract_end::text AS fecha, pl.name AS plan, p.name AS titular
  FROM sec_subscriptions s
  JOIN sec_plans pl ON pl.id = s.plan_id
  JOIN sec_properties p ON p.id = s.property_id
  WHERE s.status = 'active'
    AND s.contract_end BETWEEN $1::date - $2::int AND $1::date + $3::int
  ORDER BY s.contract_end, s.id`;

const GARANTIAS = `
  SELECT d.id::text AS id, d.device_type, ((d.install_date + make_interval(months => d.warranty_months))::date)::text AS fecha,
         p.name AS titular
  FROM sec_devices d
  JOIN sec_subscriptions s ON s.id = d.subscription_id
  JOIN sec_properties p ON p.id = s.property_id
  WHERE d.is_active AND d.install_date IS NOT NULL AND d.warranty_months IS NOT NULL
    AND s.status IN ('active', 'suspended')
    AND (d.install_date + make_interval(months => d.warranty_months))::date BETWEEN $1::date AND $1::date + $2::int
  ORDER BY 3, d.id`;

// guaynet guarda un solo certificado de monitoreo por suscripción (restricción única).
const CERTIFICADOS = `
  SELECT c.id::text AS id, c.valid_until AS fecha, p.name AS titular
  FROM sec_certificates c
  JOIN sec_subscriptions s ON s.id = c.subscription_id
  JOIN sec_properties p ON p.id = s.property_id
  WHERE s.status = 'active'
    AND c.valid_until BETWEEN $1::date::timestamptz AND ($1::date + $2::int)::timestamptz
  ORDER BY c.valid_until, c.id`;

/**
 * Providers de la línea SEGURIDAD de guaynet (módulo `sec_*`): `incidents` (alertas abiertas y
 * fallas de equipos sin restaurar) y `agenda` (contratos, garantías y certificados por vencer).
 * No expone `contacts`/`receivables`/`transactions`: la seguridad todavía no se factura en guaynet
 * (las facturas son solo de internet), así que no hay cobros que vigilar. Con eso se activan Guardia,
 * Sistemas, Agenda y la dirección; el resto queda apagado solo.
 */
export function crearProvidersSeguridad(opts: OpcionesSeguridad): ProviderRegistry {
  const db = soloLectura(opts.db);
  const { tenantId } = opts;
  const zona = opts.zona ?? "America/Argentina/Buenos_Aires";
  const propio = (ctx: TenantCtx) => ctx.tenantId === tenantId;
  const ahora = (ctx: TenantCtx) => ctx.now?.() ?? new Date();

  return {
    incidents: {
      async open(ctx) {
        if (!propio(ctx)) return { items: [] };
        const t = ahora(ctx);
        const [alertas, fallas] = await Promise.all([
          db.query(ALERTAS_ABIERTAS),
          db.query(FALLAS_ABIERTAS, [t.toISOString(), DIAS_FALLAS]),
        ]);
        return { items: [...alertas.rows.map((f) => incidenteAlerta(f, tenantId)), ...fallas.rows.map((f) => incidenteFalla(f, tenantId))] };
      },
    },
    agenda: {
      async upcoming(ctx) {
        if (!propio(ctx)) return { items: [] };
        const hoy = hoyLocal(ahora(ctx), zona);
        const [contratos, garantias, certificados] = await Promise.all([
          db.query(CONTRATOS, [hoy, DIAS_ATRAS, DIAS_ADELANTE]),
          db.query(GARANTIAS, [hoy, DIAS_ADELANTE]),
          db.query(CERTIFICADOS, [hoy, DIAS_ADELANTE]),
        ]);
        const items = [
          ...contratos.rows.map((f) => eventoVencimiento(f, tenantId, "contrato", zona)),
          ...garantias.rows.map((f) => eventoVencimiento(f, tenantId, "garantia", zona)),
          ...certificados.rows.map((f) => eventoVencimiento(f, tenantId, "certificado")),
        ].sort((a, b) => a.inicia.localeCompare(b.inicia));
        return { items };
      },
    },
  };
}
