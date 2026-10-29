import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { TenantCtx } from "@agent-core/contracts";
import { manifestsActivables, capacidadesDeProviders, runSeleccion } from "@agent-core/core";
import { catalogo } from "@agent-core/agents";
import { crearCoreStore } from "@agent-core/app-ejemplo";
import { OPCIONES_SOLO_LECTURA } from "./db.js";
import { crearProvidersWisp, MODELO_NEGOCIO_WISP } from "./providers.js";

// Integración contra POSTGRES REAL con el esquema de guaynet. Se saltea si no hay DB:
//   WISP_TEST_DATABASE_URL=postgresql://postgres:clave@localhost:5432/postgres npm test
// (el usuario tiene que poder crear bases y roles). En CI corre contra un servicio Postgres.
const URL_ADMIN = process.env.WISP_TEST_DATABASE_URL;
const T = "guaynet";
const ctx: TenantCtx = { tenantId: T, now: () => new Date("2026-08-25T15:00:00.000Z") }; // 25/08 12:00 en Argentina

const archivo = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const conUrl = (base: string, cambios: { db?: string; user?: string; pass?: string }) => {
  const u = new URL(base);
  if (cambios.db) u.pathname = `/${cambios.db}`;
  if (cambios.user) u.username = cambios.user;
  if (cambios.pass) u.password = cambios.pass;
  return u.toString();
};

describe.skipIf(!URL_ADMIN)("adapter WISP contra Postgres real (esquema de guaynet)", () => {
  const sufijo = Math.random().toString(36).slice(2, 8);
  const dbName = `wisp_test_${sufijo}`;
  const rol = `agentcore_ro_${sufijo}`;
  const clave = `clave_${sufijo}`;
  let admin: pg.Pool;     // dueño: crea y siembra
  let seed: pg.Pool;
  let ro: pg.Pool;        // lo que usan los agentes: rol de solo lectura
  let providers: ReturnType<typeof crearProvidersWisp>;

  const sql = (q: string, p?: unknown[]) => seed.query(q, p);

  async function sembrar() {
    await sql(archivo("../test/guaynet-schema.sql"));
    await sql(`INSERT INTO users (username, email, hashed_password, is_superuser) VALUES ('admin','a@x.com','$2b$12$HASHSECRETO',true)`);
    await sql(`INSERT INTO plans (name, download_mbps, upload_mbps, price) VALUES ('Hogar 30', 30, 10, 15000)`);
    await sql(`INSERT INTO mikrotik_routers (name, host, username, password_encrypted, location, status, last_seen) VALUES
      ('Torre Norte','10.0.0.1','api','CLAVE-NORTE','Norte','online', now()),
      ('Torre Sur','10.0.0.2','api','CLAVE-SUR','Sur','offline','2026-08-25T10:00:00Z')`);
    await sql(`INSERT INTO ubiquiti_devices (name, host, device_type, password_encrypted, status, last_seen, mikrotik_router_id) VALUES
      ('AP Sur 1','10.0.1.1','airmax_ap','CLAVE-AP','offline','2026-08-25T10:00:00Z', 2)`);

    // id 1..6 en orden. (router, ubiquiti): Ana R1 · Bruno R2 · Carla R2 · Diego R1 · Eva R2/U1 · Fer R2/U1
    const clientes: [string, string, string | null, string | null, string, number, number | null][] = [
      ["Ana", "Pérez", "2255-0001", "ana@x.com", "active", 1, null],
      ["Bruno", "Gómez", "2255-0002", null, "active", 2, null],
      ["Carla", "Díaz", "2255-0003", null, "suspended", 2, null],
      ["Diego", "Ruiz", "2255-0004", null, "cancelled", 1, null],
      ["Eva", "Soto", "2255-0005", null, "active", 2, 1],
      ["Fer", "Luna", null, "fer@x.com", "active", 2, 1],
    ];
    for (const [i, [n, a, tel, mail, st, r, u]] of clientes.entries()) {
      await sql(
        `INSERT INTO clients (first_name,last_name,dni,address,phone,email,ip_address,mac_address,plan_id,router_id,ubiquiti_device_id,status,billing_day)
         VALUES ($1,$2,'30111222','Calle Falsa 123',$3,$4,$5,'aa:bb:cc:dd:ee:ff',1,$6,$7,$8::clientstatus,28)`,
        [n, a, tel, mail, `10.10.0.${i + 1}`, r, u, st],
      );
    }
    // Factura mensual: emitida el 1, vence el 28; la pagan el 20.
    const factura = async (cli: number, per: string, estado: string, pagada: boolean, monto = 15000) => {
      const { rows } = await seed.query(
        `INSERT INTO invoices (client_id, period, amount, issue_date, due_date, paid_date, status)
         VALUES ($1,$2::varchar,$3,($2::text||'-01')::date,($2::text||'-28')::date,$4::date,$5::invoicestatus) RETURNING id`,
        [cli, per, monto, pagada ? `${per}-20` : null, estado],
      );
      return rows[0].id as number;
    };
    const meses = (desde: number, hasta: number) => Array.from({ length: hasta - desde + 1 }, (_, k) => `2026-${String(desde + k).padStart(2, "0")}`);
    for (const per of meses(1, 7)) await factura(1, per, "paid", true);                 // Ana: al día…
    await factura(1, "2026-08", "pending", false);                                       // …Ago vence el 28 (por vencer)
    await factura(1, "2026-09", "draft", false);                                         // borrador: no cuenta en ningún lado
    for (const per of meses(1, 6)) await factura(2, per, "paid", true);                  // Bruno
    await factura(2, "2026-07", "overdue", false);                                       // Jul vencida (marcada)
    for (const per of meses(1, 4)) await factura(3, per, "paid", true);                  // Carla dejó de pagar en abril
    for (const per of meses(5, 7)) await factura(3, per, "overdue", false);
    for (const per of ["2025-01", "2025-02", "2025-03"]) await factura(4, per, "paid", true); // Diego (baja)
    for (const per of meses(1, 7)) await factura(5, per, "paid", true);                  // Eva
    const evaAgo = await factura(5, "2026-08", "pending", false);                        // vencida el 20 pero guaynet aún no la marcó
    await sql(`UPDATE invoices SET due_date = '2026-08-20' WHERE id = $1`, [evaAgo]);
    await sql(`INSERT INTO payments (invoice_id, amount, payment_date, method) VALUES ($1, 5000, '2026-08-18', 'cash')`, [evaAgo]); // pagó 5000
    for (const per of meses(1, 7)) await factura(6, per, "paid", true);                  // Fer
    const ferAgo = await factura(6, "2026-08", "pending", false);
    await sql(`UPDATE invoices SET due_date = '2026-08-30' WHERE id = $1`, [ferAgo]);
    await sql(`INSERT INTO payments (invoice_id, amount, payment_date, method) VALUES ($1, 5000, '2026-08-22', 'transfer')`, [ferAgo]); // pago parcial
  }

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: URL_ADMIN, max: 1 });
    await admin.query(`CREATE DATABASE ${dbName}`);
    seed = new pg.Pool({ connectionString: conUrl(URL_ADMIN!, { db: dbName }), max: 2 });
    await sembrar();
    // El SQL que se le da al usuario (sql/solo-lectura.sql), tal cual, solo con rol/clave de prueba.
    const grants = archivo("../sql/solo-lectura.sql")
      .replaceAll("agentcore_ro", rol).replace("<elegí una contraseña larga>", clave).replaceAll("ON DATABASE guaynet", `ON DATABASE ${dbName}`);
    const sentencias = grants.split("\n").filter((l) => !l.startsWith("--")).join("\n").split(";").map((x) => x.trim()).filter(Boolean);
    expect(sentencias).toHaveLength(7);
    for (const st of sentencias.slice(0, 2)) await admin.query(st);   // CREATE ROLE + GRANT CONNECT (a nivel cluster)
    for (const st of sentencias.slice(2)) await seed.query(st);       // permisos sobre las tablas
    ro = new pg.Pool({ connectionString: conUrl(URL_ADMIN!, { db: dbName, user: rol, pass: clave }), max: 2, options: OPCIONES_SOLO_LECTURA });
    providers = crearProvidersWisp({ db: ro, tenantId: T });
  }, 60_000);

  afterAll(async () => {
    await ro?.end(); await seed?.end();
    // `pool.end()` resuelve antes de que los sockets cierren de verdad: borrar la base con
    // FORCE en ese instante mata sesiones a mitad de cierre y el cliente emite un 'error'
    // sin escucha (falló 1 de cada ~8 corridas bajo carga, y en CI). Se espera a que cierren.
    for (let i = 0; i < 100; i++) {
      const { rows } = await admin.query("SELECT 1 FROM pg_stat_activity WHERE datname = $1", [dbName]);
      if (rows.length === 0) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`); // red de seguridad: ya no hay sesiones
    await admin.query(`DROP ROLE IF EXISTS ${rol}`);
    await admin.end();
  });

  it("contactos: activos y suspendidos (la baja no), con id numérico como texto", async () => {
    const { items } = await providers.contacts!.list(ctx);
    expect(items.map((c) => c.nombre)).toEqual(["Ana Pérez", "Bruno Gómez", "Carla Díaz", "Eva Soto", "Fer Luna"]);
    expect(items[0]).toMatchObject({ id: "1", tenantId: T, telefonos: ["2255-0001"], emails: ["ana@x.com"], tags: ["activo"] });
    expect(items[2]!.tags).toEqual(["suspendido"]);
    expect(JSON.stringify(items)).not.toMatch(/30111222|Calle Falsa|10\.10\.0|aa:bb/); // nada de DNI, domicilio, IP, MAC
    expect((await providers.contacts!.list(ctx, { q: "gómez" })).items.map((c) => c.id)).toEqual(["2"]); // sin distinguir mayúsculas
    expect((await providers.contacts!.list(ctx, { q: "100%" })).items).toHaveLength(0); // % no es comodín
    expect((await providers.contacts!.get(ctx, "3"))?.nombre).toBe("Carla Díaz");
    expect(await providers.contacts!.get(ctx, "4")).toBeNull(); // Diego: baja
    const p1 = await providers.contacts!.list(ctx, { limit: 2 });
    expect(p1.items).toHaveLength(2);
    const p2 = await providers.contacts!.list(ctx, { limit: 2, cursor: p1.nextCursor! });
    expect(p2.items.map((c) => c.id)).toEqual(["3", "5"]);
  });

  it("cobros vencidos: incluye los vencidos por fecha aunque guaynet no los haya marcado, con saldo", async () => {
    const { items } = await providers.receivables!.overdue(ctx);
    const clave = items.map((c) => `${c.contactoId}:${(c.metadata as { periodo: string }).periodo}:${c.monto}`);
    expect(clave).toEqual([
      "3:2026-05:15000", "3:2026-06:15000",            // Carla
      "2:2026-07:15000", "3:2026-07:15000",            // Bruno y Carla (vencen el mismo día)
      "5:2026-08:10000",                               // Eva: vencida el 20 aunque sigue 'pending'; pagó 5000 → saldo 10000
    ]);
    expect(items.every((c) => c.estado === "vencido" && c.moneda === "ARS")).toBe(true);
    expect(items[0]!.venceEn).toBe("2026-05-28T00:00:00.000Z");
  });

  it("cobros por vencer: pendientes y parciales; el borrador no existe", async () => {
    const { items } = await providers.receivables!.pending(ctx);
    expect(items.map((c) => [c.contactoId, c.estado, c.monto, c.venceEn])).toEqual([
      ["1", "pendiente", 15000, "2026-08-28T00:00:00.000Z"],
      ["6", "parcial", 10000, "2026-08-30T00:00:00.000Z"],
    ]);
  });

  it("resumen de pagos: compras, frecuencia (~30 días) y recencia por abonado; sin la baja", async () => {
    const { items } = await providers.transactions!.resumenPorContacto!(ctx);
    const r = Object.fromEntries(items.map((x) => [x.contactoId, x]));
    expect(Object.keys(r).sort()).toEqual(["1", "2", "3", "5", "6"]);
    expect(r["1"]).toMatchObject({ compras: 7, totalGastado: 105000, ticketPromedio: 15000, frecuenciaDias: 30, diasDesdeUltima: 36 });
    expect(r["3"]).toMatchObject({ compras: 4, diasDesdeUltima: 127 }); // última vez que pagó: 20/04
  });

  it("transacciones: abonos del cliente y recientes (sin borradores)", async () => {
    const ana = await providers.transactions!.byContact(ctx, "1");
    expect(ana.items).toHaveLength(8); // 7 pagos + agosto; el borrador de septiembre no
    expect(ana.items[0]).toMatchObject({ titulo: "Abono 2026-08", estado: "pending", cadencia: "suscripcion", monto: 15000 });
    expect(ana.items.find((t) => t.titulo === "Abono 2026-07")).toMatchObject({ estado: "paid", cerradaEn: "2026-07-20T00:00:00.000Z" });
    expect((await providers.transactions!.recent(ctx, { limit: 3 })).items).toHaveLength(3);
  });

  it("equipos caídos → incidentes con los abonados REALES afectados", async () => {
    const { items } = await providers.incidents!.open(ctx);
    expect(items.map((i) => [i.titulo, i.nivel, i.usuariosAfectados])).toEqual([
      ["Torre Sur sin conexión", "fatal", 3],   // Bruno, Eva, Fer (Carla suspendida no cuenta)
      ["AP Sur 1 sin conexión", "error", 2],    // Eva y Fer
    ]);
    expect(items[0]).toMatchObject({ estado: "abierto", entorno: "produccion", primeraVez: "2026-08-25T10:00:00.000Z" });
  });

  it("el rol de solo lectura NO puede escribir, ni leer usuarios ni claves de los equipos", async () => {
    const falla = async (q: string) => ro.query(q).then(() => "ok", (e: Error) => e.message);
    expect(await falla("SELECT hashed_password FROM users")).toMatch(/permission denied/);
    expect(await falla("SELECT * FROM users")).toMatch(/permission denied/);
    expect(await falla("SELECT password_encrypted FROM mikrotik_routers")).toMatch(/permission denied/);
    expect(await falla("SELECT host, username FROM mikrotik_routers")).toMatch(/permission denied/);
    expect(await falla("SELECT password_encrypted FROM ubiquiti_devices")).toMatch(/permission denied/);
    expect(await falla("UPDATE clients SET status = 'active'")).toMatch(/permission denied|read-only/);
    expect(await falla("DELETE FROM invoices")).toMatch(/permission denied|read-only/);
    expect(await falla("INSERT INTO plans (name,download_mbps,upload_mbps,price) VALUES ('x',1,1,1)")).toMatch(/permission denied|read-only/);
    expect(await falla("SELECT name, status FROM mikrotik_routers")).toBe("ok"); // las columnas concedidas sí
  });

  it("aunque se conecte con el DUEÑO, la sesión de solo lectura impide escribir", async () => {
    const dueno = new pg.Pool({ connectionString: conUrl(URL_ADMIN!, { db: dbName }), max: 1, options: OPCIONES_SOLO_LECTURA });
    try {
      await expect(dueno.query("UPDATE clients SET status = 'active'")).rejects.toThrow(/read-only/);
      await expect(dueno.query("SELECT count(*) FROM clients")).resolves.toBeDefined();
    } finally { await dueno.end(); }
  });

  it("agentes reales sobre los datos: qué se activa y qué recomiendan", async () => {
    const activables = manifestsActivables(catalogo, { capacidades: capacidadesDeProviders(providers), modeloNegocio: MODELO_NEGOCIO_WISP }).map((a) => a.manifest.id).sort();
    for (const id of ["cobros", "morosidad", "cobranza_preventiva", "flujo_caja", "crm", "riesgo_abandono", "sistemas"]) expect(activables).toContain(id);
    for (const id of ["inventario", "agenda", "compliance", "rrhh", "rentabilidad", "precios", "logistica", "produccion"]) expect(activables).not.toContain(id);

    const store = crearCoreStore();
    for (const agentId of ["cobros", "morosidad", "cobranza_preventiva", "riesgo_abandono", "sistemas"]) {
      await store.agentConfig.set(ctx, { agentId, encendido: true, autonomia: "manual" });
    }
    const res = await runSeleccion({ catalogo, ctx, providers, store, modeloNegocio: MODELO_NEGOCIO_WISP });
    const por = (id: string) => res.recomendaciones.filter((r) => r.agentId === id);

    expect(por("cobros").length).toBeGreaterThanOrEqual(4);                       // las 5 facturas vencidas (según umbral)
    expect(por("cobranza_preventiva").map((r) => r.refEntidad?.tipo)).toContain("cobro");
    const abandono = por("riesgo_abandono").find((r) => r.refEntidad?.id === "3");
    expect(abandono).toBeDefined();                                                // Carla: 127 días sin pagar, frecuencia 30
    expect(abandono!.tipo).toBe("churn_perdido");
    expect(por("sistemas").length).toBeGreaterThan(0);                             // Torre Sur caída
    expect(por("sistemas")[0]!.titulo).toContain("Torre Sur");
  });
});
