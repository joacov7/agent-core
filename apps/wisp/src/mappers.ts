import type { BusinessModel, Cobro, Contacto, EstadoCobro, Incidente, ResumenContacto, Transaccion } from "@agent-core/contracts";
import type { FilaDB } from "./db.js";

// Filas SQL → modelo canónico. Puro (sin DB) para testearlo sin Postgres. Minimización de
// datos: del abonado solo viajan nombre, teléfono y email (no DNI, CUIT, domicilio, IP ni MAC).

export const CADENCIA_WISP: BusinessModel = "suscripcion";

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/** Fecha/hora de la DB → ISO-8601 UTC. Acepta `Date`, `YYYY-MM-DD` (columnas date) o timestamp. */
export function iso(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : new Date(s).toISOString();
}

/** "Hoy" (YYYY-MM-DD) en la zona del negocio: a las 22 h de Argentina ya es "mañana" en UTC. */
export function hoyLocal(ahora: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

const MS_DIA = 86_400_000;
const diaUTC = (yyyyMmDd: string) => Date.parse(`${yyyyMmDd}T00:00:00.000Z`);
export const diasEntre = (desde: string, hasta: string) => Math.round((diaUTC(hasta) - diaUTC(desde)) / MS_DIA);

export function contacto(f: FilaDB, tenantId: string): Contacto {
  const telefono = str(f.phone).trim();
  const email = str(f.email).trim();
  const c: Contacto = {
    id: str(f.id),
    tenantId,
    creadoEn: iso(f.created_at) ?? new Date(0).toISOString(),
    nombre: `${str(f.first_name)} ${str(f.last_name)}`.trim() || `Abonado ${str(f.id)}`,
    roles: ["abonado"],
    tags: [str(f.status) === "suspended" ? "suspendido" : "activo"],
    modeloNegocio: CADENCIA_WISP,
  };
  const actualizado = iso(f.updated_at);
  if (actualizado) c.actualizadoEn = actualizado;
  if (telefono) c.telefonos = [telefono];
  if (email) c.emails = [email];
  return c;
}

export function cobro(f: FilaDB, tenantId: string, moneda: string): Cobro {
  const c: Cobro = {
    id: str(f.id),
    tenantId,
    creadoEn: iso(f.created_at) ?? new Date(0).toISOString(),
    contactoId: str(f.contacto_id),
    estado: str(f.estado) as EstadoCobro,
    // Saldo pendiente (monto de la factura − lo ya pagado): un pago parcial no se cobra dos veces.
    monto: Math.round((num(f.amount) - num(f.pagado)) * 100) / 100,
    moneda,
    transaccionId: str(f.id),
    metadata: { periodo: str(f.period), pagado: num(f.pagado), total: num(f.amount) },
  };
  const vence = iso(f.due_date);
  if (vence) c.venceEn = vence;
  return c;
}

export function transaccion(f: FilaDB, tenantId: string, moneda: string): Transaccion {
  const t: Transaccion = {
    id: str(f.id),
    tenantId,
    creadoEn: iso(f.created_at) ?? new Date(0).toISOString(),
    contactoId: str(f.contacto_id),
    cadencia: CADENCIA_WISP,
    estado: str(f.status),
    titulo: `Abono ${str(f.period)}`,
    monto: num(f.amount),
    moneda,
  };
  const abierta = iso(f.issue_date);
  if (abierta) t.abiertaEn = abierta;
  const cerrada = iso(f.paid_date);
  if (cerrada) t.cerradaEn = cerrada;
  return t;
}

/** Resumen de pagos de un abonado. La "compra" de un WISP es la factura mensual PAGADA. */
export function resumenContacto(f: FilaDB, hoy: string): ResumenContacto | null {
  const compras = num(f.compras);
  const ultima = f.ultima_fecha ? str(f.ultima_fecha) : undefined;
  if (compras < 1 || !ultima) return null;
  const primera = f.primera_fecha ? str(f.primera_fecha) : ultima;
  const total = num(f.total);
  const r: ResumenContacto = {
    contactoId: str(f.contacto_id),
    compras,
    totalGastado: total,
    ticketPromedio: Math.round((total / compras) * 100) / 100,
    ultimaTransaccion: iso(ultima)!,
    diasDesdeUltima: Math.max(0, diasEntre(ultima, hoy)),
    frecuenciaDias: compras > 1 ? Math.round(diasEntre(primera, ultima) / (compras - 1)) : null,
  };
  return r;
}

/** Equipo caído → incidente. Los usuarios afectados son los abonados REALES colgados de ese equipo. */
export function incidente(f: FilaDB, tenantId: string, ahora: Date, tipo: "mikrotik" | "ubiquiti"): Incidente {
  const afectados = num(f.afectados);
  const visto = iso(f.last_seen);
  const i: Incidente = {
    id: `${tipo}:${str(f.id)}`,
    tenantId,
    creadoEn: visto ?? ahora.toISOString(),
    firma: `${tipo}:${str(f.id)}:offline`,
    titulo: `${str(f.name)} sin conexión`,
    servicio: tipo,
    entorno: "produccion",
    // Un router caído deja sin servicio a todos sus abonados; un equipo Ubiquiti, solo a los suyos.
    nivel: tipo === "mikrotik" ? "fatal" : afectados > 0 ? "error" : "warning",
    ocurrencias: 1,
    usuariosAfectados: afectados,
    ultimaVez: ahora.toISOString(),
    estado: "abierto",
    metadata: { ubicacion: f.location ?? null, tipoEquipo: f.device_type ?? "mikrotik" },
  };
  if (visto) i.primeraVez = visto;
  return i;
}
