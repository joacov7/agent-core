import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { TenantCtx } from "@agent-core/contracts";
import { capacidadesDeProviders, manifestsActivables, runSeleccion } from "@agent-core/core";
import { catalogo } from "@agent-core/agents";
import { crearCoreStore } from "@agent-core/app-ejemplo";
import { OPCIONES_SOLO_LECTURA } from "./db.js";
import { crearProvidersSeguridad, MODELO_NEGOCIO_SEGURIDAD } from "./seguridad.js";

// Integración contra POSTGRES REAL con el esquema REAL de guaynet (módulo sec_*). Se saltea sin DB:
//   WISP_TEST_DATABASE_URL=postgresql://postgres:clave@localhost:5432/postgres npm test
const URL_ADMIN = process.env.WISP_TEST_DATABASE_URL;
const T = "guaynet-seguridad";
const ctx: TenantCtx = { tenantId: T, now: () => new Date("2026-10-30T15:00:00.000Z") }; // 30/10 12:00 en Argentina

const archivo = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const conUrl = (base: string, c: { db?: string; user?: string; pass?: string }) => {
  const u = new URL(base);
  if (c.db) u.pathname = `/${c.db}`;
  if (c.user) u.username = c.user;
  if (c.pass) u.password = c.pass;
  return u.toString();
};
const sentencias = (sql: string) => sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";").map((x) => x.trim()).filter(Boolean);

describe.skipIf(!URL_ADMIN)("adapter SEGURIDAD contra Postgres real (esquema real de guaynet)", () => {
  const sufijo = Math.random().toString(36).slice(2, 8);
  const dbName = `seg_test_${sufijo}`;
  const rol = `agentcore_ro_${sufijo}`;
  const clave = `clave_${sufijo}`;
  let admin: pg.Pool; let seed: pg.Pool; let ro: pg.Pool;
  let providers: ReturnType<typeof crearProvidersSeguridad>;
  const q = (s: string, p?: unknown[]) => seed.query(s, p);

  async function sembrar() {
    await q(archivo("../test/guaynet-schema.sql"));
    await q(`INSERT INTO users (username, email, hashed_password) VALUES ('dueno','d@x.com','$2b$12$HASHSECRETO')`);
    await q(`INSERT INTO sec_plans (name, price, includes_monitoring) VALUES ('Intermedio', 12000, true)`);
    // Propiedades (con datos sensibles que el adapter NO debe leer): 1 Casa García · 2 Local Pérez · 3 Depto Sosa · 4 Obra · 5 Galpón
    for (const [n, dir] of [["Casa García", "Calle Falsa 123"], ["Local Pérez", "Av. Siempreviva 742"], ["Depto Sosa", "Calle 9 N° 100"], ["Obra", "Ruta 2 km 5"], ["Galpón", "Zona industrial"]]) {
      await q(`INSERT INTO sec_properties (owner_user_id, name, address, latitude, longitude, notes) VALUES (1, $1, $2, -37.3, -59.1, 'tiene perro')`, [n, dir]);
    }
    // Suscripciones: 1 activa (vence 15/11) · 2 activa (venció el 20/10) · 3 CANCELADA · 4 pendiente de instalar · 5 activa (vence en 2027)
    const subs: [number, string, string][] = [[1, "active", "2026-11-15"], [2, "active", "2026-10-20"], [3, "cancelled", "2026-11-01"], [4, "pending_install", "2026-11-02"], [5, "active", "2027-06-01"]];
    for (const [prop, st, fin] of subs) {
      await q(`INSERT INTO sec_subscriptions (property_id, plan_id, status, contract_end, portal_token, client_telegram_id, beat_account_id, notes)
               VALUES ($1, 1, $2, $3, $4, '555123', 'BEAT-9', 'nota privada')`, [prop, st, fin, `token-secreto-${prop}`]);
    }
    // Secretos que el rol no debe poder leer
    await q(`INSERT INTO sec_pin_credentials (property_id, pin_type, pin_hash) VALUES (1, 'duress', 'HASH-PIN')`).catch(() => undefined);
    // Alertas
    const al = (sub: number, tipo: string, st: string, disparo: string, ack?: string) =>
      q(`INSERT INTO sec_alerts (subscription_id, alert_type, status, triggered_at, acknowledged_at) VALUES ($1,$2,$3,$4,$5)`, [sub, tipo, st, disparo, ack ?? null]);
    await al(1, "PANIC", "new", "2026-10-30T14:50:00Z");                                   // sin atender hace 10 min
    await al(2, "CONNECTION_LOST", "acknowledged", "2026-10-30T13:00:00Z", "2026-10-30T13:05:00Z"); // en atención hace 2 h
    await al(1, "INTRUSION", "resolved", "2026-10-29T10:00:00Z");                          // resuelta: ignorar
    await al(3, "PANIC", "new", "2026-10-30T14:00:00Z");                                   // suscripción cancelada: ignorar
    await al(2, "SCHEDULE_VIOLATION", "false_alarm", "2026-10-30T09:00:00Z");              // falsa alarma: ignorar
    await al(4, "PANIC", "new", "2026-10-30T14:00:00Z");                                   // aún sin instalar: ignorar
    // Eventos
    const ev = (sub: number, tipo: string, cuando: string) =>
      q(`INSERT INTO sec_events (subscription_id, event_type, occurred_at, received_at, user_code, raw_data) VALUES ($1,$2,$3,$3,'1234','{"secreto":true}')`, [sub, tipo, cuando]);
    await ev(1, "battery_low", "2026-10-28T08:00:00Z"); await ev(1, "battery_restored", "2026-10-29T08:00:00Z"); // se restauró: no es falla
    await ev(1, "communication_lost", "2026-10-30T13:30:00Z");                              // falla abierta
    await ev(2, "power_failure", "2026-10-29T01:00:00Z"); await ev(2, "power_restored", "2026-10-29T02:00:00Z"); // restaurada
    await ev(2, "battery_low", "2026-10-30T08:00:00Z");                                     // falla abierta
    await ev(2, "tamper", "2026-08-01T08:00:00Z");                                          // más de 30 días: ignorar
    await ev(3, "communication_lost", "2026-10-30T10:00:00Z");                              // cancelada: ignorar
    await ev(1, "zone_open", "2026-10-30T14:00:00Z");                                       // evento común: no es falla
    // Equipos y certificados
    await q(`INSERT INTO sec_devices (subscription_id, device_type, install_date, warranty_months, is_active) VALUES
      (1,'sensor_smoke','2025-12-20',12,true), (1,'siren','2025-12-25',12,false), (2,'panel','2023-01-01',24,true), (3,'camera','2026-01-01',12,true)`);
    const cert = (sub: number, emitido: string, vence: string, tok: string) =>
      q(`INSERT INTO sec_certificates (subscription_id, issued_at, valid_until, verification_token) VALUES ($1,$2,$3,$4)`, [sub, emitido, vence, tok]);
    await cert(1, "2025-11-25", "2026-11-25", "tok-b");   // vence en 26 días: entra en la agenda
    await cert(2, "2026-01-01", "2027-01-01", "tok-c");   // vence en 2027: fuera de la ventana (uno solo por suscripción)
  }

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: URL_ADMIN, max: 1 });
    await admin.query(`CREATE DATABASE ${dbName}`);
    seed = new pg.Pool({ connectionString: conUrl(URL_ADMIN!, { db: dbName }), max: 2 });
    await sembrar();
    // Los DOS archivos SQL de permisos que se le dan al usuario, tal cual (solo rol/clave/base de prueba).
    const base = archivo("../sql/solo-lectura.sql").replaceAll("agentcore_ro", rol).replace("<elegí una contraseña larga>", clave).replaceAll("ON DATABASE guaynet", `ON DATABASE ${dbName}`);
    const st = sentencias(base);
    for (const s of st.slice(0, 2)) await admin.query(s);     // CREATE ROLE + GRANT CONNECT (cluster)
    for (const s of st.slice(2)) await seed.query(s);
    for (const s of sentencias(archivo("../sql/solo-lectura-seguridad.sql").replaceAll("agentcore_ro", rol))) await seed.query(s);
    ro = new pg.Pool({ connectionString: conUrl(URL_ADMIN!, { db: dbName, user: rol, pass: clave }), max: 2, options: OPCIONES_SOLO_LECTURA });
    providers = crearProvidersSeguridad({ db: ro, tenantId: T });
  }, 60_000);

  afterAll(async () => {
    await ro?.end(); await seed?.end();
    for (let i = 0; i < 100; i++) { // esperar a que cierren las sesiones (pool.end() resuelve antes que los sockets)
      const { rows } = await admin.query("SELECT 1 FROM pg_stat_activity WHERE datname = $1", [dbName]);
      if (rows.length === 0) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.query(`DROP ROLE IF EXISTS ${rol}`);
    await admin?.end();
  });

  it("alertas abiertas → incidentes (nueva/reconocida; no resueltas, ni falsas, ni de suscripciones canceladas o sin instalar)", async () => {
    const { items } = await providers.incidents!.open(ctx);
    const alertas = items.filter((i) => i.servicio === "alarma").map((i) => [i.titulo, i.nivel, i.estado, i.primeraVez]);
    expect(alertas).toEqual([
      ["Conexión del panel perdida".replace("Conexión del panel perdida", "Pérdida de conexión del panel"), "error", "reconocido", "2026-10-30T13:00:00.000Z"],
      ["Pánico", "fatal", "nuevo", "2026-10-30T14:50:00.000Z"],
    ]);
    expect(items.find((i) => i.titulo === "Pánico")!.metadata).toMatchObject({ titular: "Casa García" });
  });

  it("fallas de equipos: solo la que quedó SIN restaurar, dentro de los últimos 30 días y de suscripciones vivas", async () => {
    const { items } = await providers.incidents!.open(ctx);
    const fallas = items.filter((i) => i.servicio === "equipo").map((i) => [i.id, i.titulo, i.nivel, i.primeraVez]);
    expect(fallas).toEqual([
      ["falla:2:bateria", "Batería baja en el panel", "warning", "2026-10-30T08:00:00.000Z"],
      ["falla:1:comunicacion", "Panel sin comunicación", "error", "2026-10-30T13:30:00.000Z"],
    ]);
    expect(items).toHaveLength(4);
  });

  it("agenda: contratos (vencido hace 10 días / en 16), garantía y certificado; nada fuera de ventana ni de suscripciones no activas", async () => {
    const { items } = await providers.agenda!.upcoming(ctx);
    // Contratos y garantías valen hasta el FIN del día en Argentina (02:59:59Z del día siguiente).
    expect(items.map((e) => [e.id.split(":")[0], e.inicia])).toEqual([
      ["contrato", "2026-10-21T02:59:59.000Z"], ["contrato", "2026-11-16T02:59:59.000Z"],
      ["certificado", "2026-11-25T00:00:00.000Z"], ["garantia", "2026-12-21T02:59:59.000Z"],
    ]);
    expect(items[0]).toMatchObject({ titulo: "Contrato de monitoreo (Intermedio) por vencer", metadata: { titular: "Local Pérez" } });
    expect(items[3]!.titulo).toBe("Garantía de detector de humo por vencer");
    expect(JSON.stringify(items)).not.toMatch(/Calle Falsa|Siempreviva|token-secreto|555123|BEAT-9|nota privada/);
  });

  it("el rol de solo lectura NO puede leer PINs, palabras seguras, tokens, Telegram, domicilios ni datos crudos", async () => {
    const falla = (s: string) => ro.query(s).then(() => "ok", (e: Error) => e.message);
    for (const tabla of ["sec_pin_credentials", "sec_safe_words", "sec_app_devices", "sec_telegram_links", "sec_beat_webhooks", "sec_property_members", "sec_emergency_contacts", "sec_contracts"]) {
      expect(await falla(`SELECT * FROM ${tabla}`)).toMatch(/permission denied/);
    }
    for (const [col, tabla] of [["portal_token", "sec_subscriptions"], ["client_telegram_id", "sec_subscriptions"], ["beat_account_id", "sec_subscriptions"], ["notes", "sec_subscriptions"],
      ["address", "sec_properties"], ["latitude", "sec_properties"], ["owner_user_id", "sec_properties"], ["notes", "sec_properties"],
      ["raw_data", "sec_events"], ["user_code", "sec_events"], ["description", "sec_events"], ["operator_notes", "sec_alerts"], ["serial_number", "sec_devices"], ["verification_token", "sec_certificates"]]) {
      expect(await falla(`SELECT ${col} FROM ${tabla}`), `${tabla}.${col}`).toMatch(/permission denied/);
    }
    expect(await falla("SELECT * FROM sec_subscriptions")).toMatch(/permission denied/);          // ni con *
    expect(await falla("SELECT id, status, contract_end FROM sec_subscriptions")).toBe("ok");    // lo concedido sí
    expect(await falla("UPDATE sec_alerts SET status = 'resolved'")).toMatch(/permission denied|read-only/);
    expect(await falla("DELETE FROM sec_events")).toMatch(/permission denied|read-only/);
    expect(await falla("SELECT * FROM users")).toMatch(/permission denied/);
  });

  it("agentes reales sobre la línea de seguridad: qué se activa y qué recomiendan (Guardia, Agenda, Sistemas)", async () => {
    const activables = manifestsActivables(catalogo, { capacidades: capacidadesDeProviders(providers), modeloNegocio: MODELO_NEGOCIO_SEGURIDAD }).map((a) => a.manifest.id).sort();
    for (const id of ["guardia", "sistemas", "agenda", "asistente", "ceo", "jefe"]) expect(activables).toContain(id);
    for (const id of ["cobros", "morosidad", "cobranza_preventiva", "flujo_caja", "crm", "riesgo_abandono", "inventario"]) expect(activables).not.toContain(id); // no hay facturación ni clientes de internet acá

    const store = crearCoreStore();
    for (const agentId of ["guardia", "agenda"]) await store.agentConfig.set(ctx, { agentId, encendido: true, autonomia: "manual" });
    const r = await runSeleccion({ catalogo, ctx, providers, store, modeloNegocio: MODELO_NEGOCIO_SEGURIDAD });
    const guardia = r.recomendaciones.filter((x) => x.agentId === "guardia").map((x) => [x.titulo, x.severidad]).sort();
    expect(guardia).toEqual([
      ["Batería baja en el panel: sin atender hace 7 h 0 min".replace("7 h 0 min", "7 h"), "importante"],
      ["Pánico: sin atender hace 10 min", "critica"],
      ["Panel sin comunicación: sin atender hace 90 min".replace("90 min", "1 h 30 min"), "critica"],
      ["Pérdida de conexión del panel: en atención hace 2 h, sin resolver", "importante"],
    ].sort());
    const agenda = r.recomendaciones.filter((x) => x.agentId === "agenda");
    // El agente de Agenda avisa a ≤7 días (importante ≤2): de los 4 vencimientos solo el contrato YA vencido
    // genera aviso; el resto (16, 26 y 51 días) está fuera de su ventana y entra a medida que se acerca.
    expect(agenda.map((x) => [x.titulo, x.severidad])).toEqual([["Contrato de monitoreo (Intermedio) por vencer (vencido hace 10 día(s))", "critica"]]);
    expect(JSON.stringify(r.recomendaciones)).not.toMatch(/García|Pérez|Sosa/);   // ningún nombre de cliente en lo que irá a Telegram
  });
});
