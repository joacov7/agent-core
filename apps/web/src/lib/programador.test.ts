import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import type { Notificador, Recomendacion, TenantCtx } from "@agent-core/contracts";
import { crearApp } from "@agent-core/app-ejemplo";
import { crearServicio, type AgenteVista, type RecomendacionVista, type Servicio } from "./service";
import {
  CONFIG_POR_DEFECTO, ahoraLocal, enSilencio, estadoVacio, leerConfigProgramador, parseHora, tareasPendientes, tick,
  type ConfigProgramador, type EstadoProgramador,
} from "./programador";
import { cargarEstado, guardarEstado } from "./programador-estado";

// Argentina es UTC-3 todo el año: 08:05 ART = 11:05 UTC.
const art = (hora: string, dia = "2026-10-29") => new Date(`${dia}T${hora}:00-03:00`);
const cfg = (over: Partial<ConfigProgramador> = {}): ConfigProgramador => ({ ...CONFIG_POR_DEFECTO, ...over });
const ctx: TenantCtx = { tenantId: "t1" };

describe("tiempo y config", () => {
  it("hora local en la zona del negocio (a las 23 h de Argentina ya es 'mañana' en UTC)", () => {
    expect(ahoraLocal(art("08:05"), "America/Argentina/Buenos_Aires")).toEqual({ fecha: "2026-10-29", minutos: 8 * 60 + 5 });
    expect(ahoraLocal(art("23:30"), "America/Argentina/Buenos_Aires").fecha).toBe("2026-10-29");
    expect(ahoraLocal(art("23:30"), "UTC").fecha).toBe("2026-10-30");
    expect(ahoraLocal(art("00:10"), "America/Argentina/Buenos_Aires").minutos).toBe(10); // no "24:10"
  });

  it("parseHora y franja de silencio (incluida la que cruza la medianoche)", () => {
    expect(parseHora("08:30")).toBe(510);
    expect(parseHora("8:05")).toBe(485);
    for (const mala of ["24:00", "8", "08:60", "ocho", ""]) expect(parseHora(mala)).toBeNull();
    const noche = { desde: "22:00", hasta: "08:00" };
    expect([enSilencio(23 * 60, noche), enSilencio(3 * 60, noche), enSilencio(8 * 60, noche), enSilencio(12 * 60, noche), enSilencio(21 * 60 + 59, noche)]).toEqual([true, true, false, false, false]);
    expect(enSilencio(13 * 60, { desde: "12:00", hasta: "14:00" })).toBe(true);
    expect(enSilencio(15 * 60, null)).toBe(false);
  });

  it("leerConfigProgramador: defaults, valores válidos y advertencias sin romper", () => {
    expect(leerConfigProgramador({})).toEqual({ cfg: CONFIG_POR_DEFECTO, advertencias: [] });
    const ok = leerConfigProgramador({ RESUMEN_HORA: "07:30", ALERTAS_CADA_MIN: "15", ALERTAS_SILENCIO: "23:00-07:00", ALERTAS_MAX_DIA: "3", AVISOS_NOMBRES: "on", PUBLIC_URL: "http://10.0.0.5:3100/", AVISOS_ZONA: "America/Montevideo" });
    expect(ok.cfg).toMatchObject({ resumenHora: "07:30", alertasCadaMin: 15, silencio: { desde: "23:00", hasta: "07:00" }, maxAlertasDia: 3, incluirNombres: true, url: "http://10.0.0.5:3100/bandeja", zona: "America/Montevideo" });
    expect(ok.advertencias).toEqual([]);
    expect(leerConfigProgramador({ ALERTAS_SILENCIO: "off" }).cfg.silencio).toBeNull();
    const mal = leerConfigProgramador({ RESUMEN_HORA: "25:99", ALERTAS_CADA_MIN: "-3", ALERTAS_MAX_DIA: "mucho", ALERTAS_SILENCIO: "de noche", AVISOS_ZONA: "Marte/Olympus" });
    expect(mal.cfg).toEqual(CONFIG_POR_DEFECTO);
    expect(mal.advertencias).toHaveLength(5);
    expect(leerConfigProgramador({ AVISOS_NOMBRES: "" }).cfg.incluirNombres).toBe(false); // privacidad: off por defecto
  });
});

describe("tareasPendientes", () => {
  const vacio = estadoVacio();
  it("resumen: solo desde la hora y dentro de la ventana, una vez por día", () => {
    expect(tareasPendientes(art("07:59"), vacio, cfg({ alertasCadaMin: 0 }))).toEqual([]);
    expect(tareasPendientes(art("08:00"), vacio, cfg({ alertasCadaMin: 0 }))).toEqual(["resumen"]);
    expect(tareasPendientes(art("10:00"), vacio, cfg({ alertasCadaMin: 0 }))).toEqual(["resumen"]);   // borde de la ventana
    expect(tareasPendientes(art("10:01"), vacio, cfg({ alertasCadaMin: 0 }))).toEqual([]);            // ya sería un resumen viejo
    expect(tareasPendientes(art("09:00"), { ...vacio, ultimoResumen: "2026-10-29" }, cfg({ alertasCadaMin: 0 }))).toEqual([]);
    expect(tareasPendientes(art("09:00", "2026-10-30"), { ...vacio, ultimoResumen: "2026-10-29" }, cfg({ alertasCadaMin: 0, resumenHora: "08:30" }))).toEqual(["resumen"]); // día nuevo
  });

  it("resumen: tras un fallo espera el reintento", () => {
    const e: EstadoProgramador = { ...vacio, proximoIntentoResumen: art("08:15").getTime() };
    expect(tareasPendientes(art("08:10"), e, cfg({ alertasCadaMin: 0 }))).toEqual([]);
    expect(tareasPendientes(art("08:15"), e, cfg({ alertasCadaMin: 0 }))).toEqual(["resumen"]);
  });

  it("alertas: cada N min, nunca en la franja de silencio, 0 = apagadas", () => {
    expect(tareasPendientes(art("12:00"), vacio, cfg())).toEqual(["alertas"]);
    expect(tareasPendientes(art("12:20"), { ...vacio, ultimaCorridaAlertas: art("12:00").getTime() }, cfg())).toEqual([]);
    expect(tareasPendientes(art("12:30"), { ...vacio, ultimaCorridaAlertas: art("12:00").getTime() }, cfg())).toEqual(["alertas"]);
    expect(tareasPendientes(art("23:00"), vacio, cfg())).toEqual([]);                  // silencio
    expect(tareasPendientes(art("03:00"), vacio, cfg())).toEqual([]);                  // silencio (cruza medianoche)
    expect(tareasPendientes(art("23:00"), vacio, cfg({ silencio: null }))).toEqual(["alertas"]);
    expect(tareasPendientes(art("12:00"), vacio, cfg({ alertasCadaMin: 0 }))).toEqual([]);
  });

  it("a las 08:00 cuando termina el silencio toca resumen y alertas", () => {
    expect(tareasPendientes(art("08:00"), vacio, cfg())).toEqual(["resumen", "alertas"]);
  });
});

// ── tick con un servicio controlado ───────────────────────────────────────────────────────────
let n = 0;
const reco = (over: Partial<RecomendacionVista> = {}): RecomendacionVista => ({
  id: `r${++n}`, tenantId: "t1", creadoEn: "2026-10-29T00:00:00.000Z", agentId: "cobros", tipo: "cobro_vencido",
  titulo: "Cobrar 15000 ARS (vencido hace 30 día(s))", estado: "proposed", severidad: "critica", confianza: 95, prioridad: 1,
  impactoEstimado: 15000, dedupKey: `cobros:cobro:${n}`, refEntidad: { tipo: "cobro", id: `c${n}` }, ...over,
});
const vista = (id: string, nombre: string, rol: string, encendido: boolean): AgenteVista => ({
  manifest: { id } as never, persona: { nombre, rol, saludo: "", personalizado: false }, estado: "en_espera", novedades: 0,
  disponible: true, encendido, autonomia: "manual",
});

function montar(opts: { asistente?: boolean; recos?: RecomendacionVista[]; correrFalla?: () => boolean } = {}) {
  const f = { recos: opts.recos ?? [], asistente: opts.asistente ?? true, correr: 0, falla: opts.correrFalla ?? (() => false) };
  const servicio = {
    async listarAgentes() { return [vista("asistente", "Gael", "Asistente personal", f.asistente), vista("cobros", "Lou", "Cobros", true)]; },
    async correr() { f.correr++; if (f.falla()) throw new Error("base caída"); return { ejecutados: [], recomendaciones: [] }; },
    async listarRecomendaciones() { return f.recos; },
  } as unknown as Servicio;
  const enviados: string[] = [];
  const e = { fallar: 0 };
  const notificador: Notificador = {
    async enviar(_c, m) { if (e.fallar > 0) { e.fallar--; throw new Error("telegram caído"); } enviados.push(m.texto); },
  };
  const estado = estadoVacio();
  let guardados = 0;
  let reloj = art("08:05");
  const logs: string[] = [];
  const correrTick = (c: Partial<ConfigProgramador> = {}) =>
    tick({ servicio, notificador, cfg: cfg(c), estado, guardar: () => { guardados++; }, ahora: () => reloj, ctx: () => ctx, log: (m) => logs.push(m) });
  return { f, e, enviados, estado, logs, correrTick, hora: (h: string, dia?: string) => { reloj = art(h, dia); }, guardados: () => guardados };
}

describe("tick", () => {
  it("con el Asistente APAGADO no corre, no escribe y no avisa (fail-closed)", async () => {
    const m = montar({ asistente: false, recos: [reco()] });
    expect(await m.correrTick()).toEqual({ apagado: true });
    expect(m.f.correr).toBe(0);
    expect(m.enviados).toHaveLength(0);
    expect(m.guardados()).toBe(0);
  });

  it("08:05: manda el resumen UNA vez por día; lo crítico del resumen no se repite como alerta", async () => {
    const m = montar({ recos: [reco(), reco({ agentId: "cobros", severidad: "importante", prioridad: 3 })] });
    expect(await m.correrTick()).toMatchObject({ resumen: "enviado", alertas: "nada_nuevo" });
    expect(m.enviados).toHaveLength(1);
    expect(m.enviados[0]).toContain("☀️ Buen día · resumen del 29/10");
    expect(m.enviados[0]).toContain("Lou · Cobros");               // usa el nombre (alias) del agente
    expect(m.estado.ultimoResumen).toBe("2026-10-29");

    m.hora("08:40");
    expect(await m.correrTick()).toMatchObject({ alertas: "nada_nuevo" }); // la crítica ya figuraba en el resumen
    expect(m.enviados).toHaveLength(1);
    expect(m.guardados()).toBeGreaterThan(0);
  });

  it("alertas: avisa lo crítico NUEVO una sola vez, aunque el motor lo refresque (cambia el título)", async () => {
    const r = reco({ dedupKey: "cobros:cobro:77", titulo: "vencido hace 11 días" });
    const m = montar({ recos: [r] });
    m.hora("12:00");
    expect(await m.correrTick()).toEqual({ alertas: "enviado" });
    expect(m.enviados[0]).toContain("🚨 Aviso urgente (1)");

    m.f.recos = [{ ...r, titulo: "vencido hace 12 días", actualizadoEn: "2026-10-30T00:00:00Z" }]; // refrescada por el motor
    m.hora("12:30");
    expect(await m.correrTick()).toEqual({ alertas: "nada_nuevo" });

    m.f.recos = [...m.f.recos, reco({ titulo: "Torre Sur sin conexión", agentId: "sistemas" })]; // aparece algo nuevo
    m.hora("13:00");
    expect(await m.correrTick()).toEqual({ alertas: "enviado" });
    expect(m.enviados).toHaveLength(2);
    expect(m.enviados[1]).toContain("(1)");
    expect(m.enviados[1]).toContain("Torre Sur");
  });

  it("solo alerta lo CRÍTICO y abierto: importantes, oportunidades y resueltas no", async () => {
    const m = montar({ recos: [reco({ severidad: "importante" }), reco({ severidad: "oportunidad" }), reco({ estado: "executed" })] });
    m.hora("12:00");
    expect(await m.correrTick()).toEqual({ alertas: "nada_nuevo" });
    expect(m.enviados).toHaveLength(0);
  });

  it("tope diario de mensajes de alerta; al otro día se renueva; lo que quedó figura en el resumen", async () => {
    const m = montar({ recos: [reco()] });
    m.hora("12:00");
    expect(await m.correrTick({ maxAlertasDia: 1 })).toEqual({ alertas: "enviado" });
    m.f.recos = [...m.f.recos, reco()];
    m.hora("13:00");
    expect(await m.correrTick({ maxAlertasDia: 1 })).toEqual({ alertas: "tope_diario" });
    expect(m.enviados).toHaveLength(1);
    m.hora("12:00", "2026-10-30");
    expect(await m.correrTick({ maxAlertasDia: 1 })).toEqual({ alertas: "enviado" }); // día nuevo, tope renovado
  });

  it("en la franja de silencio no corre nada", async () => {
    const m = montar({ recos: [reco()] });
    m.hora("23:30");
    expect(await m.correrTick()).toEqual({});
    expect(m.f.correr).toBe(0);
  });

  it("si Telegram falla el resumen NO se da por enviado: reintenta a los 10 min, no antes", async () => {
    const m = montar({ recos: [reco()] });
    m.e.fallar = 1;
    expect(await m.correrTick({ alertasCadaMin: 0 })).toEqual({ resumen: "error" });
    expect(m.estado.ultimoResumen).toBeUndefined();
    expect(m.estado.ultimoError?.mensaje).toContain("telegram caído");
    m.hora("08:09");
    expect(await m.correrTick({ alertasCadaMin: 0 })).toEqual({});                  // todavía en espera
    m.hora("08:16");
    expect(await m.correrTick({ alertasCadaMin: 0 })).toEqual({ resumen: "enviado" });
    expect(m.enviados).toHaveLength(1);
  });

  it("si falla una alerta, NO se marca como avisada: se reintenta en la próxima revisión", async () => {
    const m = montar({ recos: [reco()] });
    m.hora("12:00");
    m.e.fallar = 1;
    expect(await m.correrTick()).toEqual({ alertas: "error" });
    expect(Object.keys(m.estado.avisados)).toHaveLength(0);
    expect(m.estado.avisosDia.n).toBe(0);
    m.hora("12:30");
    expect(await m.correrTick()).toEqual({ alertas: "enviado" });
  });

  it("si la fuente de datos falla, no avisa nada engañoso, lo registra y no tumba el tick", async () => {
    const m = montar({ recos: [reco()], correrFalla: () => true });
    expect(await m.correrTick()).toMatchObject({ resumen: "error", alertas: "error" });
    expect(m.enviados).toHaveLength(0);
    expect(m.logs.join("\n")).toContain("base caída");
    expect(m.estado.proximoIntentoResumen).toBeGreaterThan(art("08:05").getTime());
  });

  it("privacidad: sin AVISOS_NOMBRES los mensajes no llevan nombres de clientes; con la opción, sí", async () => {
    const r = reco({ titular: { id: "5", nombre: "Ana Pérez" } });
    const sin = montar({ recos: [r] });
    await sin.correrTick();
    expect(sin.enviados.join("\n")).not.toContain("Ana");
    const con = montar({ recos: [r] });
    await con.correrTick({ incluirNombres: true });
    expect(con.enviados.join("\n")).toContain("Ana Pérez");
  });

  it("poda las claves de avisos viejas (14 días)", async () => {
    const m = montar({ recos: [] });
    m.estado.avisados = { "viejo|k": "2026-09-01", "reciente|k": "2026-10-28" };
    m.hora("12:00");
    await m.correrTick();
    expect(Object.keys(m.estado.avisados)).toEqual(["reciente|k"]);
  });
});

describe("tick con el servicio real: el motor deduplica, la bandeja NO crece con las corridas", () => {
  it("5 revisiones seguidas dejan la misma cantidad de recomendaciones y avisan una sola vez", async () => {
    const app = crearApp();
    const demo: TenantCtx = { tenantId: "demo", now: () => new Date("2026-08-25T12:00:00.000Z") }; // los datos de ejemplo son del tenant "demo"
    const servicio = crearServicio({ store: app.store, providers: app.providers, modeloNegocio: app.modeloNegocio });
    for (const id of ["asistente", "cobros", "inventario", "crm"]) await servicio.setAgente(demo, { agentId: id, encendido: true, autonomia: "manual" });
    const enviados: string[] = [];
    const notificador: Notificador = { async enviar(_c, m) { enviados.push(m.texto); } };
    const estado = estadoVacio();
    let t = art("12:00");
    const una = () => tick({ servicio, notificador, cfg: cfg(), estado, guardar: () => {}, ahora: () => t, ctx: () => demo, log: () => {} });

    const r1 = await una();
    const total = (await servicio.listarRecomendaciones(demo)).length;
    expect(total).toBeGreaterThan(0);
    expect(r1.alertas).toBe("enviado");                         // el retail de ejemplo tiene un cobro crítico
    for (let i = 0; i < 4; i++) { t = new Date(t.getTime() + 31 * 60_000); await una(); }
    expect((await servicio.listarRecomendaciones(demo)).length).toBe(total); // no creció
    expect(enviados).toHaveLength(1);                           // y no repitió el aviso
  });
});

describe("persistencia del estado", () => {
  it("guarda y recarga; un archivo roto o inexistente arranca vacío", async () => {
    const dir = await mkdtemp(join(tmpdir(), "prog-"));
    const ruta = join(dir, "sub", "estado.json");
    const e: EstadoProgramador = { ...estadoVacio(), ultimoResumen: "2026-10-29", ultimaCorridaAlertas: 123, avisados: { "a|b": "2026-10-29" }, avisosDia: { fecha: "2026-10-29", n: 2 } };
    await guardarEstado(ruta, e);
    expect(await cargarEstado(ruta)).toEqual(e);
    expect(((await stat(ruta)).mode & 0o777).toString(8)).toBe("600");   // solo el dueño lo lee
    await writeFile(ruta, "{ esto no es json");
    expect(await cargarEstado(ruta)).toEqual(estadoVacio());
    expect(await cargarEstado(join(dir, "no-existe.json"))).toEqual(estadoVacio());
  });
});
