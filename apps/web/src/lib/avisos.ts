import type { Notificador, TenantCtx } from "@agent-core/contracts";
import { crearNotificadorTelegram } from "@agent-core/notify-telegram";
import { esError } from "@/lib/errores";
import { servicio } from "@/lib/app";
import { tenantPorDefecto } from "@/lib/tenant";
import { enSilencio, estadoVacio, leerConfigProgramador, tick, ahoraLocal, type ConfigProgramador, type EstadoProgramador } from "@/lib/programador";
import { cargarEstado, guardarEstado } from "@/lib/programador-estado";

// Arranque del programador de avisos del Asistente personal + estado público + mensaje de prueba.
// Singleton en globalThis (ver lib/app.ts). NUNCA expone el token, los chat ids ni mensajes de error
// internos: estos endpoints no tienen login todavía.

type Env = Record<string, string | undefined>;

interface Runtime {
  cfg: ConfigProgramador;
  notificador?: Notificador;
  chats: number;
  scheduler: boolean;
  iniciado: boolean;
  estado: EstadoProgramador;
  corriendo: boolean;
  ultimaPrueba: number;
}
const g = globalThis as unknown as { __avisos?: Runtime };

export function crearNotificadorDesdeEnv(env: Env): { notificador?: Notificador; chats: number } {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = (env.TELEGRAM_CHAT_IDS ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  if (!token || chatIds.length === 0) return { chats: chatIds.length };
  try {
    return {
      chats: chatIds.length,
      notificador: crearNotificadorTelegram({ token, chatIds, ...(env.TELEGRAM_API_URL ? { apiBase: env.TELEGRAM_API_URL } : {}) }),
    };
  } catch (e) {
    console.error("[avisos] configuración de Telegram inválida:", esError(e, "NotificadorError") ? e.message : "error");
    return { chats: chatIds.length };
  }
}

function runtime(env: Env = process.env): Runtime {
  if (!g.__avisos) {
    const { cfg, advertencias } = leerConfigProgramador(env);
    for (const a of advertencias) console.warn(`[avisos] ${a}`);
    const { notificador, chats } = crearNotificadorDesdeEnv(env);
    g.__avisos = {
      cfg, chats, scheduler: (env.SCHEDULER ?? "").trim().toLowerCase() === "on",
      iniciado: false, estado: estadoVacio(), corriendo: false, ultimaPrueba: 0,
      ...(notificador ? { notificador } : {}),
    };
  }
  return g.__avisos;
}

const ctxDefecto = (): TenantCtx => ({ tenantId: tenantPorDefecto(), requestId: crypto.randomUUID(), now: () => new Date() });

/** Arranca el programador si `SCHEDULER=on` y hay canal. Idempotente. Lo llama `instrumentation.ts`. */
export function iniciarProgramador(env: Env = process.env): void {
  const rt = runtime(env);
  if (rt.iniciado) return;
  if (!rt.scheduler) return; // fail-closed: hay que prenderlo explícitamente
  if (!rt.notificador) {
    console.warn("[avisos] SCHEDULER=on pero falta TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_IDS: no se enviará nada.");
    return;
  }
  rt.iniciado = true;
  const ruta = env.ESTADO_ARCHIVO?.trim() || ".agentcore/estado-avisos.json";
  const cada = Math.max(1_000, Number(env.TICK_MS) || 60_000);
  const notificador = rt.notificador;

  void cargarEstado(ruta).then((estado) => {
    rt.estado = estado;
    const s = rt.cfg.silencio ? `${rt.cfg.silencio.desde}-${rt.cfg.silencio.hasta}` : "sin franja";
    console.log(`[avisos] programador activo · resumen ${rt.cfg.resumenHora} · alertas ${rt.cfg.alertasCadaMin ? `cada ${rt.cfg.alertasCadaMin} min (silencio ${s}, máx. ${rt.cfg.maxAlertasDia}/día)` : "apagadas"} · ${rt.chats} chat(s)`);

    const pulso = async () => {
      if (rt.corriendo) return; // un solo tick a la vez
      rt.corriendo = true;
      try {
        await tick({
          servicio, notificador, cfg: rt.cfg, estado: rt.estado, ahora: () => new Date(), ctx: ctxDefecto,
          log: (m) => console.error(m),
          guardar: () => guardarEstado(ruta, rt.estado).catch((e) => console.error("[avisos] no pude guardar el estado:", (e as Error).message)),
        });
      } catch (e) {
        console.error("[avisos] error en el programador:", e instanceof Error ? e.message : e);
      } finally {
        rt.corriendo = false;
      }
    };
    setTimeout(() => void pulso(), 5_000).unref?.();
    setInterval(() => void pulso(), cada).unref?.();
  });
}

export interface EstadoAvisosPublico {
  programador: "activo" | "apagado" | "sin_canal";
  telegram: boolean;
  asistenteEncendido: boolean;
  asistente: string;
  resumenHora: string;
  alertasCadaMin: number;
  silencio: string | null;
  enSilencioAhora: boolean;
  maxAlertasDia: number;
  incluirNombres: boolean;
  ultimoResumen?: string;
  avisosHoy: number;
  huboError: boolean;
}

export async function estadoAvisos(ctx: TenantCtx = ctxDefecto()): Promise<EstadoAvisosPublico> {
  const rt = runtime();
  const agentes = await servicio.listarAgentes(ctx);
  const a = agentes.find((x) => x.manifest.id === "asistente");
  const hoy = ahoraLocal(new Date(), rt.cfg.zona);
  const r: EstadoAvisosPublico = {
    programador: !rt.scheduler ? "apagado" : rt.notificador ? "activo" : "sin_canal",
    telegram: Boolean(rt.notificador),
    asistenteEncendido: Boolean(a?.encendido),
    asistente: a?.persona.nombre ?? "Asistente",
    resumenHora: rt.cfg.resumenHora,
    alertasCadaMin: rt.cfg.alertasCadaMin,
    silencio: rt.cfg.silencio ? `${rt.cfg.silencio.desde}-${rt.cfg.silencio.hasta}` : null,
    enSilencioAhora: enSilencio(hoy.minutos, rt.cfg.silencio),
    maxAlertasDia: rt.cfg.maxAlertasDia,
    incluirNombres: rt.cfg.incluirNombres,
    avisosHoy: rt.estado.avisosDia.fecha === hoy.fecha ? rt.estado.avisosDia.n : 0,
    huboError: Boolean(rt.estado.ultimoError),
  };
  if (rt.estado.ultimoResumen) r.ultimoResumen = rt.estado.ultimoResumen;
  return r;
}

export type ResultadoPrueba = { ok: true } | { ok: false; status: number; error: string };

/** Manda un mensaje de prueba (sirve aunque SCHEDULER esté apagado). Una por cada 30 s. */
export async function enviarPrueba(ctx: TenantCtx = ctxDefecto()): Promise<ResultadoPrueba> {
  const rt = runtime();
  if (!rt.notificador) return { ok: false, status: 503, error: "Telegram no está configurado: faltan TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_IDS." };
  const ahora = Date.now();
  if (ahora - rt.ultimaPrueba < 30_000) return { ok: false, status: 429, error: "Esperá unos segundos antes de mandar otra prueba." };
  rt.ultimaPrueba = ahora;
  const a = (await servicio.listarAgentes(ctx)).find((x) => x.manifest.id === "asistente");
  try {
    await rt.notificador.enviar(ctx, { texto: `✅ Prueba: soy ${a?.persona.nombre ?? "tu asistente"}. Si leés esto, los avisos por Telegram funcionan.` });
    return { ok: true };
  } catch (e) {
    const msg = esError(e, "NotificadorError") ? e.message : "No pude enviar el mensaje.";
    console.error("[avisos] la prueba falló:", msg);
    return { ok: false, status: 502, error: msg };
  }
}
