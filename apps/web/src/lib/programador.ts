import type { Notificador, Recomendacion, TenantCtx } from "@agent-core/contracts";
import { abiertas, claveAviso, componerAlerta, componerResumen } from "@agent-core/agents";
import type { Servicio } from "./service";

// Programador de avisos del Asistente personal. TODA la decisión es pura y se testea sin timers
// ni red: `tareasPendientes` dice qué toca a esta hora; `tick` lo ejecuta contra un servicio y un
// notificador inyectados. Solo AVISA (resumen de la mañana + alertas urgentes): no ejecuta acciones.
// Fail-closed: si el Asistente está apagado o no hay canal, no escribe nada.

export interface ConfigProgramador {
  zona: string;
  /** Hora del resumen de la mañana, "HH:MM" en `zona`. */
  resumenHora: string;
  /** Si la app estuvo caída, el resumen se manda hasta N min después de la hora (pasado eso, sería viejo). */
  ventanaResumenMin: number;
  /** Cada cuántos minutos se revisan alertas urgentes (0 = sin alertas). */
  alertasCadaMin: number;
  /** Franja sin alertas (puede cruzar la medianoche). null = sin franja. */
  silencio: { desde: string; hasta: string } | null;
  /** Tope de mensajes de alerta por día. */
  maxAlertasDia: number;
  /** Incluir nombres de clientes en los mensajes (el chat de Telegram no tiene cifrado de extremo a extremo). */
  incluirNombres: boolean;
  url?: string;
}

export const CONFIG_POR_DEFECTO: ConfigProgramador = {
  zona: "America/Argentina/Buenos_Aires",
  resumenHora: "08:00",
  ventanaResumenMin: 120,
  alertasCadaMin: 30,
  silencio: { desde: "22:00", hasta: "08:00" },
  maxAlertasDia: 5,
  incluirNombres: false,
};

export interface EstadoProgramador {
  /** Fecha local (YYYY-MM-DD) del último resumen enviado. */
  ultimoResumen?: string;
  /** Tras un fallo, no reintentar el resumen antes de este instante (epoch ms). */
  proximoIntentoResumen?: number;
  ultimaCorridaAlertas?: number;
  /** claveAviso → fecha local en que se avisó. Evita avisar dos veces de lo mismo. */
  avisados: Record<string, string>;
  avisosDia: { fecha: string; n: number };
  ultimoError?: { cuando: string; mensaje: string };
}

type Env = Record<string, string | undefined>;

/**
 * Config desde variables de entorno. Un valor inválido NO rompe el arranque: se usa el default y
 * se devuelve una advertencia (para loguearla). Ver `.env.example`.
 */
export function leerConfigProgramador(env: Env): { cfg: ConfigProgramador; advertencias: string[] } {
  const adv: string[] = [];
  const cfg: ConfigProgramador = { ...CONFIG_POR_DEFECTO };
  const vacio = (v: string | undefined) => v === undefined || v.trim() === "";

  if (!vacio(env.AVISOS_ZONA)) {
    try { new Intl.DateTimeFormat("en", { timeZone: env.AVISOS_ZONA!.trim() }); cfg.zona = env.AVISOS_ZONA!.trim(); }
    catch { adv.push(`AVISOS_ZONA inválida ("${env.AVISOS_ZONA}"): uso ${cfg.zona}.`); }
  }
  if (!vacio(env.RESUMEN_HORA)) {
    if (parseHora(env.RESUMEN_HORA!) !== null) cfg.resumenHora = env.RESUMEN_HORA!.trim();
    else adv.push(`RESUMEN_HORA inválida ("${env.RESUMEN_HORA}", esperaba HH:MM): uso ${cfg.resumenHora}.`);
  }
  const entero = (clave: string, min: number, max: number, poner: (n: number) => void, actual: number) => {
    const v = env[clave];
    if (vacio(v)) return;
    const n = Number(v);
    if (Number.isInteger(n) && n >= min && n <= max) poner(n);
    else adv.push(`${clave} inválido ("${v}", esperaba un entero entre ${min} y ${max}): uso ${actual}.`);
  };
  entero("ALERTAS_CADA_MIN", 0, 1440, (n) => { cfg.alertasCadaMin = n; }, cfg.alertasCadaMin);
  entero("ALERTAS_MAX_DIA", 0, 100, (n) => { cfg.maxAlertasDia = n; }, cfg.maxAlertasDia);

  if (!vacio(env.ALERTAS_SILENCIO)) {
    const v = env.ALERTAS_SILENCIO!.trim().toLowerCase();
    const m = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(v);
    if (v === "off") cfg.silencio = null;
    else if (m && parseHora(m[1]!) !== null && parseHora(m[2]!) !== null) cfg.silencio = { desde: m[1]!, hasta: m[2]! };
    else adv.push(`ALERTAS_SILENCIO inválido ("${env.ALERTAS_SILENCIO}", esperaba HH:MM-HH:MM u off): uso ${CONFIG_POR_DEFECTO.silencio!.desde}-${CONFIG_POR_DEFECTO.silencio!.hasta}.`);
  }
  cfg.incluirNombres = ["on", "1", "true", "si", "sí"].includes((env.AVISOS_NOMBRES ?? "").trim().toLowerCase());
  if (!vacio(env.PUBLIC_URL)) cfg.url = `${env.PUBLIC_URL!.trim().replace(/\/+$/, "")}/bandeja`;
  return { cfg, advertencias: adv };
}

export const estadoVacio = (): EstadoProgramador => ({ avisados: {}, avisosDia: { fecha: "", n: 0 } });

// ── Tiempo ──────────────────────────────────────────────────────────────────────────────────
export function ahoraLocal(ahora: Date, zona: string): { fecha: string; minutos: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(ahora).map((x) => [x.type, x.value]),
  );
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

/** "08:30" → 510. Null si no es una hora válida. */
export function parseHora(h: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(h.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function enSilencio(minutos: number, s: ConfigProgramador["silencio"]): boolean {
  if (!s) return false;
  const d = parseHora(s.desde), h = parseHora(s.hasta);
  if (d === null || h === null || d === h) return false;
  return d < h ? minutos >= d && minutos < h : minutos >= d || minutos < h; // cruza la medianoche
}

export type Tarea = "resumen" | "alertas";

/** Qué toca ahora. Pura: no mira reloj ni red. */
export function tareasPendientes(ahora: Date, estado: EstadoProgramador, cfg: ConfigProgramador): Tarea[] {
  const t: Tarea[] = [];
  const { fecha, minutos } = ahoraLocal(ahora, cfg.zona);
  const hora = parseHora(cfg.resumenHora);
  if (
    hora !== null && minutos >= hora && minutos - hora <= cfg.ventanaResumenMin &&
    estado.ultimoResumen !== fecha && ahora.getTime() >= (estado.proximoIntentoResumen ?? 0)
  ) t.push("resumen");
  if (
    cfg.alertasCadaMin > 0 && !enSilencio(minutos, cfg.silencio) &&
    (estado.ultimaCorridaAlertas === undefined || ahora.getTime() - estado.ultimaCorridaAlertas >= cfg.alertasCadaMin * 60_000)
  ) t.push("alertas");
  return t;
}

// ── Ejecución ───────────────────────────────────────────────────────────────────────────────
export interface DepsTick {
  servicio: Servicio;
  notificador: Notificador;
  cfg: ConfigProgramador;
  /** Mutable: `tick` lo actualiza y luego llama a `guardar`. */
  estado: EstadoProgramador;
  guardar(): void | Promise<void>;
  ahora(): Date;
  ctx(): TenantCtx;
  log(mensaje: string): void;
}

export interface ResultadoTick {
  resumen?: "enviado" | "error";
  alertas?: "enviado" | "nada_nuevo" | "tope_diario" | "error";
  apagado?: true;
}

const REINTENTO_RESUMEN_MS = 10 * 60_000;
const RETENER_AVISADOS_DIAS = 14;

const msj = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export async function tick(d: DepsTick): Promise<ResultadoTick> {
  const ahora = d.ahora();
  const { fecha } = ahoraLocal(ahora, d.cfg.zona);
  const pend = tareasPendientes(ahora, d.estado, d.cfg);
  if (pend.length === 0) return {};

  const ctx = d.ctx();
  const agentes = await d.servicio.listarAgentes(ctx);
  const asistente = agentes.find((a) => a.manifest.id === "asistente");
  if (!asistente?.encendido) return { apagado: true }; // el interruptor es el propio agente: apagado → silencio total

  const salida: ResultadoTick = {};
  const falla = (e: unknown) => { d.estado.ultimoError = { cuando: ahora.toISOString(), mensaje: msj(e) }; };

  try {
    await d.servicio.correr(ctx); // pone al día la bandeja (el motor deduplica: no duplica ni crece)
  } catch (e) {
    falla(e);
    d.log(`[avisos] no pude correr el equipo: ${msj(e)}`);
    if (pend.includes("resumen")) { d.estado.proximoIntentoResumen = ahora.getTime() + REINTENTO_RESUMEN_MS; salida.resumen = "error"; }
    if (pend.includes("alertas")) { d.estado.ultimaCorridaAlertas = ahora.getTime(); salida.alertas = "error"; }
    await d.guardar();
    return salida;
  }

  const recos = await d.servicio.listarRecomendaciones(ctx);
  const nombres = Object.fromEntries(agentes.map((a) => [a.manifest.id, a.persona.nombre]));
  const roles = Object.fromEntries(agentes.map((a) => [a.manifest.id, a.persona.rol]));
  const titulares = Object.fromEntries(recos.flatMap((r) => (r.titular ? [[r.id, r.titular.nombre]] : [])));
  const opts = {
    fecha, nombres, roles, titulares, incluirNombres: d.cfg.incluirNombres,
    ...(d.cfg.url ? { url: d.cfg.url } : {}),
  };
  const criticas = abiertas(recos).filter((r: Recomendacion) => r.severidad === "critica");
  const marcar = (rs: Recomendacion[]) => { for (const r of rs) d.estado.avisados[claveAviso(r)] = fecha; };

  if (pend.includes("resumen")) {
    try {
      await d.notificador.enviar(ctx, { texto: componerResumen(recos, opts) });
      d.estado.ultimoResumen = fecha;
      delete d.estado.proximoIntentoResumen;
      marcar(criticas); // lo crítico ya está en el resumen: la próxima alerta no lo repite
      salida.resumen = "enviado";
    } catch (e) {
      falla(e);
      d.estado.proximoIntentoResumen = ahora.getTime() + REINTENTO_RESUMEN_MS;
      d.log(`[avisos] no pude enviar el resumen: ${msj(e)}`);
      salida.resumen = "error";
    }
  }

  if (pend.includes("alertas")) {
    d.estado.ultimaCorridaAlertas = ahora.getTime();
    if (d.estado.avisosDia.fecha !== fecha) d.estado.avisosDia = { fecha, n: 0 };
    const nuevas = criticas.filter((r) => !d.estado.avisados[claveAviso(r)]);
    if (nuevas.length === 0) salida.alertas = "nada_nuevo";
    else if (d.estado.avisosDia.n >= d.cfg.maxAlertasDia) salida.alertas = "tope_diario"; // quedan para el resumen de mañana
    else {
      try {
        await d.notificador.enviar(ctx, { texto: componerAlerta(nuevas, opts) });
        marcar(nuevas);
        d.estado.avisosDia.n += 1;
        salida.alertas = "enviado";
      } catch (e) {
        falla(e);
        d.log(`[avisos] no pude enviar la alerta: ${msj(e)}`);
        salida.alertas = "error";
      }
    }
  }

  // Poda: no acumular claves viejas para siempre.
  const corte = Date.parse(`${fecha}T00:00:00Z`) - RETENER_AVISADOS_DIAS * 86_400_000;
  for (const [k, f] of Object.entries(d.estado.avisados)) if (Date.parse(`${f}T00:00:00Z`) < corte) delete d.estado.avisados[k];

  await d.guardar();
  return salida;
}
