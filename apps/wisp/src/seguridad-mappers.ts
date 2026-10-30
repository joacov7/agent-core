import type { Evento, Incidente } from "@agent-core/contracts";
import type { FilaDB } from "./db.js";
import { iso } from "./mappers.js";

// Filas SQL del módulo Seguridad de guaynet (sec_*) → modelo canónico. Puro (sin DB).
// Privacidad: el nombre del cliente/propiedad viaja SOLO en `metadata.titular` (para mostrarlo
// en la app si se quiere); los títulos son neutros, así un resumen por Telegram no lo filtra.

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/** Tipo de alerta de guaynet → texto neutro y gravedad. */
const ALERTAS: Record<string, { titulo: string; nivel: "fatal" | "error" | "warning" }> = {
  PANIC: { titulo: "Pánico", nivel: "fatal" },
  DURESS: { titulo: "Coacción (PIN de coacción)", nivel: "fatal" },
  INTRUSION: { titulo: "Intrusión", nivel: "fatal" },
  ENTRY_TIMEOUT: { titulo: "Entrada sin confirmar a tiempo", nivel: "fatal" },
  CHECKIN_MISSED: { titulo: "Check-in omitido", nivel: "error" },
  INACTIVITY: { titulo: "Sin actividad", nivel: "error" },
  SYSTEM_FAULT: { titulo: "Falla del sistema", nivel: "error" },
  CONNECTION_LOST: { titulo: "Pérdida de conexión del panel", nivel: "error" },
  SCHEDULE_VIOLATION: { titulo: "Horario incumplido", nivel: "warning" },
};

/** Familia de falla de equipo (último evento sin su "restaurado") → texto y gravedad. */
const FALLAS: Record<string, { titulo: string; nivel: "error" | "warning" }> = {
  bateria: { titulo: "Batería baja en el panel", nivel: "warning" },
  energia: { titulo: "Corte de energía en el panel", nivel: "error" },
  comunicacion: { titulo: "Panel sin comunicación", nivel: "error" },
  sabotaje: { titulo: "Posible sabotaje (tamper)", nivel: "error" },
};

const titular = (f: FilaDB) => (f.titular === null || f.titular === undefined ? {} : { titular: str(f.titular) });

/** Alerta abierta (nueva o reconocida) → incidente. "nuevo" = nadie la tomó; "reconocido" = en atención. */
export function incidenteAlerta(f: FilaDB, tenantId: string): Incidente {
  const tipo = str(f.alert_type);
  const def = ALERTAS[tipo] ?? { titulo: `Alerta ${tipo}`, nivel: "error" as const };
  const disparo = iso(f.triggered_at);
  const i: Incidente = {
    id: `alerta:${str(f.id)}`,
    tenantId,
    creadoEn: disparo ?? new Date(0).toISOString(),
    firma: `alerta:${str(f.id)}`,
    titulo: def.titulo,
    servicio: "alarma",
    entorno: "produccion",
    nivel: def.nivel,
    ocurrencias: 1,
    usuariosAfectados: 1,
    estado: str(f.status) === "acknowledged" ? "reconocido" : "nuevo",
    metadata: { ...titular(f), tipoAlerta: tipo },
  };
  if (disparo) { i.primeraVez = disparo; i.ultimaVez = iso(f.acknowledged_at) ?? disparo; }
  return i;
}

/** Último evento de una familia que NO fue restaurado → falla abierta de un equipo. */
export function incidenteFalla(f: FilaDB, tenantId: string): Incidente {
  const familia = str(f.familia);
  const def = FALLAS[familia] ?? { titulo: `Falla (${familia})`, nivel: "warning" as const };
  const desde = iso(f.occurred_at);
  const i: Incidente = {
    id: `falla:${str(f.subscription_id)}:${familia}`,
    tenantId,
    creadoEn: desde ?? new Date(0).toISOString(),
    firma: `falla:${str(f.subscription_id)}:${familia}`,
    titulo: def.titulo,
    servicio: "equipo",
    entorno: "produccion",
    nivel: def.nivel,
    ocurrencias: 1,
    usuariosAfectados: 1,
    estado: "abierto",
    metadata: { ...titular(f), familia },
  };
  if (desde) { i.primeraVez = desde; i.ultimaVez = desde; }
  return i;
}

/**
 * Fin del día `fecha` (YYYY-MM-DD) en la zona del negocio, como instante ISO. Un contrato o una
 * garantía que "vence el 20" vale HASTA el final del 20. Con la fecha a las 00:00 UTC, el agente de
 * Agenda (`floor((evento − ahora)/día)`) lo daría por vencido durante el propio día de vencimiento.
 */
export function finDeDia(fecha: string, zona: string): string {
  const [y, m, d] = fecha.split("-").map(Number) as [number, number, number];
  const mediodia = new Date(Date.UTC(y, m - 1, d, 12));
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(mediodia).map((x) => [x.type, x.value]),
  );
  const offsetMs = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - mediodia.getTime(); // zona − UTC
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59) - offsetMs).toISOString();
}

type Vencimiento = "contrato" | "garantia" | "certificado";
const TIPO_EVENTO: Record<Vencimiento, string> = { contrato: "vencimiento_contrato", garantia: "garantia_equipo", certificado: "certificado_monitoreo" };

const DEVICE: Record<string, string> = {
  panel: "panel", sensor_motion: "sensor de movimiento", sensor_magnetic: "sensor magnético", sensor_smoke: "detector de humo",
  sensor_glass: "sensor de vidrio", siren: "sirena", keypad: "teclado", camera: "cámara", communicator: "comunicador", other: "equipo",
};

/** Contrato / garantía / certificado por vencer → evento de agenda (fecha en `fecha`, YYYY-MM-DD o timestamp). */
export function eventoVencimiento(f: FilaDB, tenantId: string, tipo: Vencimiento, zona = "America/Argentina/Buenos_Aires"): Evento {
  // Contratos y garantías son fechas de día completo ("YYYY-MM-DD"): valen hasta el final de ese día.
  // El certificado es un instante real (timestamptz).
  const esDia = typeof f.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha);
  const inicia = esDia ? finDeDia(f.fecha as string, zona) : (iso(f.fecha) ?? new Date(0).toISOString());
  const titulo =
    tipo === "contrato" ? `Contrato de monitoreo${f.plan ? ` (${str(f.plan)})` : ""} por vencer`
    : tipo === "garantia" ? `Garantía de ${DEVICE[str(f.device_type).toLowerCase()] ?? "equipo"} por vencer`
    : "Certificado de monitoreo por vencer";
  return {
    id: `${tipo}:${str(f.id)}`,
    tenantId,
    creadoEn: inicia,
    tipo: TIPO_EVENTO[tipo],
    titulo,
    inicia,
    refEntidad: { tipo: tipo === "garantia" ? "dispositivo" : tipo === "contrato" ? "suscripcion" : "certificado", id: str(f.id) },
    metadata: titular(f),
  };
}
