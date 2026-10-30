import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import type { FilaDB, Queryable } from "./db.js";
import { incidenteAlerta, incidenteFalla, eventoVencimiento, finDeDia } from "./seguridad-mappers.js";
import { crearProvidersSeguridad, MODELO_NEGOCIO_SEGURIDAD } from "./seguridad.js";
import { readFileSync } from "node:fs";

const T = "guaynet-seguridad";
const NOW = new Date("2026-10-30T15:00:00.000Z");

describe("mappers de seguridad", () => {
  it("alerta abierta → incidente: gravedad por tipo, estado nuevo/reconocido y el nombre SOLO en metadata", () => {
    const panico = incidenteAlerta({ id: "7", alert_type: "PANIC", status: "new", triggered_at: new Date("2026-10-30T14:50:00Z"), titular: "Casa García" }, T);
    expect(panico).toMatchObject({
      id: "alerta:7", firma: "alerta:7", titulo: "Pánico", nivel: "fatal", estado: "nuevo", servicio: "alarma", entorno: "produccion",
      primeraVez: "2026-10-30T14:50:00.000Z", usuariosAfectados: 1, metadata: { titular: "Casa García", tipoAlerta: "PANIC" },
    });
    expect(panico.titulo).not.toContain("García");                       // el título es neutro: no filtra el nombre por Telegram

    const conexion = incidenteAlerta({ id: "8", alert_type: "CONNECTION_LOST", status: "acknowledged", triggered_at: "2026-10-30T13:00:00Z", acknowledged_at: "2026-10-30T13:05:00Z" }, T);
    expect(conexion).toMatchObject({ nivel: "error", estado: "reconocido", ultimaVez: "2026-10-30T13:05:00.000Z" });
    expect(conexion.metadata).not.toHaveProperty("titular");

    expect(incidenteAlerta({ id: "9", alert_type: "SCHEDULE_VIOLATION", status: "new", triggered_at: "2026-10-30T10:00:00Z" }, T).nivel).toBe("warning");
    for (const t of ["PANIC", "DURESS", "INTRUSION", "ENTRY_TIMEOUT"]) expect(incidenteAlerta({ id: "1", alert_type: t, status: "new", triggered_at: "2026-10-30T10:00:00Z" }, T).nivel).toBe("fatal");
    expect(incidenteAlerta({ id: "1", alert_type: "TIPO_NUEVO", status: "new", triggered_at: "2026-10-30T10:00:00Z" }, T)).toMatchObject({ titulo: "Alerta TIPO_NUEVO", nivel: "error" }); // un tipo futuro no rompe
  });

  it("falla de equipo → incidente abierto con clave estable por suscripción y familia", () => {
    const f = incidenteFalla({ subscription_id: "3", familia: "comunicacion", occurred_at: "2026-10-30T13:30:00Z", titular: "Local Pérez" }, T);
    expect(f).toMatchObject({ id: "falla:3:comunicacion", firma: "falla:3:comunicacion", titulo: "Panel sin comunicación", nivel: "error", estado: "abierto", servicio: "equipo", primeraVez: "2026-10-30T13:30:00.000Z" });
    expect(incidenteFalla({ subscription_id: "3", familia: "bateria", occurred_at: "2026-10-30T13:30:00Z" }, T).nivel).toBe("warning");
  });

  it("vencimientos → eventos de agenda con título neutro", () => {
    expect(eventoVencimiento({ id: "1", fecha: "2026-11-15", plan: "Intermedio", titular: "Casa García" }, T, "contrato")).toMatchObject({
      id: "contrato:1", tipo: "vencimiento_contrato", titulo: "Contrato de monitoreo (Intermedio) por vencer", inicia: "2026-11-16T02:59:59.000Z", // fin del 15/11 en Argentina
      refEntidad: { tipo: "suscripcion", id: "1" }, metadata: { titular: "Casa García" },
    });
    expect(eventoVencimiento({ id: "4", fecha: "2026-12-20", device_type: "sensor_smoke" }, T, "garantia").titulo).toBe("Garantía de detector de humo por vencer");
    expect(eventoVencimiento({ id: "5", fecha: new Date("2026-11-20T03:00:00Z") }, T, "certificado")).toMatchObject({ tipo: "certificado_monitoreo", inicia: "2026-11-20T03:00:00.000Z" });
  });
});

describe("finDeDia: un vencimiento 'del día D' vale hasta el final de D en la zona del negocio", () => {
  it("Argentina (UTC−3), UTC y zonas con otro desfase", () => {
    expect(finDeDia("2026-10-20", "America/Argentina/Buenos_Aires")).toBe("2026-10-21T02:59:59.000Z");
    expect(finDeDia("2026-10-20", "UTC")).toBe("2026-10-20T23:59:59.000Z");
    expect(finDeDia("2026-10-20", "Asia/Tokyo")).toBe("2026-10-20T14:59:59.000Z");
  });

  it("el agente de Agenda ya no marca como vencido un contrato el MISMO día de su vencimiento", async () => {
    const { diasHasta } = await import("@agent-core/agents");
    const hoy = new Date("2026-10-30T15:00:00Z");                                                 // 12:00 en Argentina
    expect(diasHasta("2026-10-30T00:00:00.000Z", hoy)).toBe(-1);                                  // el problema: fecha pelada → "vencido hace 1 día"
    expect(diasHasta(finDeDia("2026-10-30", "America/Argentina/Buenos_Aires"), hoy)).toBe(0);     // hoy vence → "en 0 días"
    expect(diasHasta(finDeDia("2026-10-29", "America/Argentina/Buenos_Aires"), hoy)).toBe(-1);    // ayer venció → "hace 1 día"
    expect(diasHasta(finDeDia("2026-10-20", "America/Argentina/Buenos_Aires"), hoy)).toBe(-10);   // coincide con el calendario
  });
});

describe("providers de seguridad", () => {
  function dbFalsa() {
    const llamadas: { sql: string; params?: unknown[] }[] = [];
    const db: Queryable = { async query(sql, params) { llamadas.push({ sql, ...(params ? { params } : {}) }); return { rows: [] as FilaDB[] }; } };
    return { db, llamadas };
  }
  const ctx: TenantCtx = { tenantId: T, now: () => NOW };

  it("solo expone incidents y agenda (la seguridad no se factura: no hay cobros que vigilar)", () => {
    expect(Object.keys(crearProvidersSeguridad({ db: dbFalsa().db, tenantId: T })).sort()).toEqual(["agenda", "incidents"]);
    expect(MODELO_NEGOCIO_SEGURIDAD).toBe("suscripcion");
  });

  it("todo SELECT parametrizado y NINGUNA consulta toca PINs, tokens, Telegram, domicilios ni datos crudos", async () => {
    const { db, llamadas } = dbFalsa();
    const p = crearProvidersSeguridad({ db, tenantId: T });
    await p.incidents!.open(ctx);
    await p.agenda!.upcoming(ctx);
    expect(llamadas.length).toBe(5);
    for (const { sql } of llamadas) {
      expect(sql).toMatch(/^\s*(select|with)\b/i);
      expect(sql).not.toMatch(/pin_|safe_word|portal_token|telegram|beat_account|beat_webhook|app_device|address|latitude|longitude|raw_data|user_code|\bnotes\b|password|owner_user_id|\bcity\b/i);
    }
    expect(llamadas.every((l) => !l.params || l.params.every((x) => typeof x === "string" || typeof x === "number"))).toBe(true);
  });

  it("otro tenant (p.ej. la línea de internet) no ve nada ni llega a la DB", async () => {
    const { db, llamadas } = dbFalsa();
    const p = crearProvidersSeguridad({ db, tenantId: T });
    expect(await p.incidents!.open({ tenantId: "guaynet" })).toEqual({ items: [] });
    expect(await p.agenda!.upcoming({ tenantId: "guaynet" })).toEqual({ items: [] });
    expect(llamadas).toHaveLength(0);
  });

  it("'hoy' es el de la zona del negocio (a las 23 h de Argentina ya es mañana en UTC)", async () => {
    const { db, llamadas } = dbFalsa();
    const p = crearProvidersSeguridad({ db, tenantId: T });
    await p.agenda!.upcoming({ tenantId: T, now: () => new Date("2026-10-31T02:30:00Z") });   // 30/10 23:30 ART
    expect(llamadas[0]!.params![0]).toBe("2026-10-30");
  });

  it("el SQL de permisos de seguridad no concede nada sensible", () => {
    const sql = readFileSync(new URL("../sql/solo-lectura-seguridad.sql", import.meta.url), "utf8")
      .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(sql).not.toMatch(/pin_credentials|safe_words|app_devices|telegram_links|beat_webhooks|portal_token|client_telegram_id|beat_account_id|address|latitude|raw_data|user_code|\bnotes\b/i);
    expect(sql.match(/GRANT SELECT \(/g)).toHaveLength(7);                  // todo por columna, ningún GRANT sobre la tabla entera
    expect(sql).not.toMatch(/GRANT SELECT ON/i);
  });
});
