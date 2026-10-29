import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import { LIMITE_MAXIMO, pagina, soloLectura, ventana, type FilaDB, type Queryable } from "./db.js";
import { cobro, contacto, diasEntre, hoyLocal, incidente, iso, resumenContacto, transaccion } from "./mappers.js";
import { crearProvidersWisp } from "./providers.js";

// Unitarios (sin DB): mapeo fila→canónico, paginación, guardas de solo lectura y aislamiento de
// tenant. Las consultas SQL en sí se prueban contra Postgres real en wisp.pg.test.ts.

const T = "guaynet";
const NOW = new Date("2026-08-26T02:30:00.000Z"); // 25/08 23:30 en Argentina, ya "26" en UTC

describe("mappers", () => {
  it("contacto: solo nombre/teléfono/email (nada de DNI, domicilio, IP ni MAC)", () => {
    const c = contacto({
      id: "7", first_name: "Ana", last_name: "Pérez", phone: " 2255-1234 ", email: "", status: "suspended",
      created_at: new Date("2026-01-02T03:04:05Z"), dni: "30111222", address: "Calle 1", ip_address: "10.0.0.7", mac_address: "aa:bb",
    }, T);
    expect(c).toMatchObject({ id: "7", tenantId: T, nombre: "Ana Pérez", telefonos: ["2255-1234"], tags: ["suspendido"], roles: ["abonado"], modeloNegocio: "suscripcion" });
    expect(c.emails).toBeUndefined();
    expect(JSON.stringify(c)).not.toMatch(/30111222|Calle 1|10\.0\.0\.7|aa:bb/);
  });

  it("cobro: el monto es el SALDO (factura − pagado) y el vencimiento es ISO", () => {
    const c = cobro({ id: "3", contacto_id: "7", estado: "parcial", amount: "15000.00", pagado: "5000.00", due_date: "2026-08-30", period: "2026-08", created_at: "2026-08-01" }, T, "ARS");
    expect(c).toMatchObject({ id: "3", contactoId: "7", estado: "parcial", monto: 10000, moneda: "ARS", venceEn: "2026-08-30T00:00:00.000Z" });
  });

  it("resumenContacto: frecuencia = días entre pagos, recencia = días desde el último", () => {
    const r = resumenContacto({ contacto_id: "7", compras: "4", total: "60000", ultima_fecha: "2026-04-10", primera_fecha: "2026-01-10" }, "2026-08-25")!;
    expect(r).toMatchObject({ contactoId: "7", compras: 4, totalGastado: 60000, ticketPromedio: 15000, diasDesdeUltima: 137, frecuenciaDias: 30 });
    expect(resumenContacto({ contacto_id: "7", compras: "1", total: "1", ultima_fecha: "2026-08-10", primera_fecha: "2026-08-10" }, "2026-08-25")!.frecuenciaDias).toBeNull();
    expect(resumenContacto({ contacto_id: "7", compras: "0" }, "2026-08-25")).toBeNull();
  });

  it("transaccion e incidente", () => {
    expect(transaccion({ id: "9", contacto_id: "7", period: "2026-07", amount: "15000", status: "paid", issue_date: "2026-07-01", paid_date: "2026-07-10", created_at: "2026-07-01" }, T, "ARS"))
      .toMatchObject({ cadencia: "suscripcion", titulo: "Abono 2026-07", monto: 15000, abiertaEn: "2026-07-01T00:00:00.000Z", cerradaEn: "2026-07-10T00:00:00.000Z" });
    const router = incidente({ id: "2", name: "Torre Sur", last_seen: "2026-08-25T10:00:00Z", afectados: "40" }, T, NOW, "mikrotik");
    expect(router).toMatchObject({ firma: "mikrotik:2:offline", nivel: "fatal", usuariosAfectados: 40, estado: "abierto", entorno: "produccion" });
    expect(incidente({ id: "1", name: "AP", afectados: "0", device_type: "unifi_ap" }, T, NOW, "ubiquiti").nivel).toBe("warning");
    expect(incidente({ id: "1", name: "AP", afectados: "5" }, T, NOW, "ubiquiti").nivel).toBe("error");
  });

  it("fechas: iso() y 'hoy' en la zona del negocio", () => {
    expect(iso("2026-08-30")).toBe("2026-08-30T00:00:00.000Z");
    expect(iso(null)).toBeUndefined();
    expect(hoyLocal(NOW, "America/Argentina/Buenos_Aires")).toBe("2026-08-25"); // no "26"
    expect(hoyLocal(NOW, "UTC")).toBe("2026-08-26");
    expect(diasEntre("2026-04-10", "2026-08-25")).toBe(137);
  });
});

describe("paginación", () => {
  it("el tope por defecto es alto (los agentes no siguen nextCursor) y con limit pagina", () => {
    expect(ventana()).toEqual({ limit: LIMITE_MAXIMO, offset: 0 });
    expect(ventana({ limit: 99_999_999 }).limit).toBe(LIMITE_MAXIMO);
    expect(ventana({ limit: 0 }).limit).toBe(1);
    expect(ventana({ limit: 2, cursor: "4" })).toEqual({ limit: 2, offset: 4 });
    expect(ventana({ cursor: "'; drop table x" }).offset).toBe(0);
    const v = ventana({ limit: 2 });
    expect(pagina([1, 2, 3], v)).toEqual({ items: [1, 2], nextCursor: "2" });
    expect(pagina([1, 2], v)).toEqual({ items: [1, 2] });
  });
});

describe("solo lectura y tenant", () => {
  function dbFalsa() {
    const llamadas: { sql: string; params?: unknown[] }[] = [];
    const db: Queryable = { async query(sql, params) { llamadas.push({ sql, ...(params ? { params } : {}) }); return { rows: [] as FilaDB[] }; } };
    return { db, llamadas };
  }

  it("soloLectura rechaza todo lo que no sea SELECT", async () => {
    const { db, llamadas } = dbFalsa();
    const ro = soloLectura(db);
    for (const sql of ["UPDATE clients SET status='active'", "DELETE FROM invoices", "DROP TABLE clients", "INSERT INTO plans VALUES (1)", "WITH x AS (DELETE FROM invoices RETURNING 1) SELECT 1", "TRUNCATE payments"]) {
      await expect(ro.query(sql)).rejects.toThrow(/solo lectura/);
    }
    await expect(ro.query("SELECT created_at, updated_at FROM clients")).resolves.toBeDefined(); // "created"/"updated" no es un verbo
    expect(llamadas).toHaveLength(1);
  });

  it("todas las consultas del adapter son SELECT parametrizados y no tocan users ni claves", async () => {
    const { db, llamadas } = dbFalsa();
    const ctx: TenantCtx = { tenantId: T, now: () => NOW };
    const p = crearProvidersWisp({ db, tenantId: T });
    await p.contacts!.list(ctx, { q: "x'; drop" });
    await p.contacts!.get(ctx, "5");
    await p.receivables!.overdue(ctx);
    await p.receivables!.pending(ctx);
    await p.transactions!.recent(ctx);
    await p.transactions!.byContact(ctx, "5");
    await p.transactions!.resumenPorContacto!(ctx);
    await p.incidents!.open(ctx);
    expect(llamadas.length).toBe(9);
    for (const { sql } of llamadas) {
      expect(sql).toMatch(/^\s*(select|with)\b/i);
      expect(sql).not.toMatch(/\busers\b|password|hashed|dni|cuit|address|ip_address|mac_address|\bhost\b/i);
    }
    // Lo que escribe el usuario viaja como parámetro, nunca pegado al SQL.
    expect(llamadas[0]!.sql).not.toContain("drop");
    expect(llamadas[0]!.params).toContain("x'; drop");
  });

  it("otro tenant no ve nada ni llega a la DB (falla cerrado); ids no numéricos tampoco", async () => {
    const { db, llamadas } = dbFalsa();
    const p = crearProvidersWisp({ db, tenantId: T });
    const otro: TenantCtx = { tenantId: "otro" };
    expect(await p.contacts!.list(otro)).toEqual({ items: [] });
    expect(await p.contacts!.get(otro, "1")).toBeNull();
    expect(await p.receivables!.overdue(otro)).toEqual({ items: [] });
    expect(await p.transactions!.resumenPorContacto!(otro)).toEqual({ items: [] });
    expect(await p.incidents!.open(otro)).toEqual({ items: [] });
    expect(await p.contacts!.get({ tenantId: T }, "1; DROP TABLE clients")).toBeNull();
    expect(await p.transactions!.byContact({ tenantId: T }, "abc")).toEqual({ items: [] });
    expect(llamadas).toHaveLength(0);
  });

  it("expone solo las capacidades que guaynet tiene", () => {
    const { db } = dbFalsa();
    expect(Object.keys(crearProvidersWisp({ db, tenantId: T })).sort()).toEqual(["contacts", "incidents", "receivables", "transactions"]);
  });
});
