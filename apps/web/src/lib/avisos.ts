import type { Notificador, TenantCtx } from "@agent-core/contracts";
import { crearNotificadorTelegram } from "@agent-core/notify-telegram";
import { servicioDe } from "@/lib/app";
import { esError } from "@/lib/errores";
import { LINEAS } from "@/lib/lineas";
import { tenantPorDefecto } from "@/lib/tenant";
import {
  ahoraLocal, enSilencio, estadoVacio, leerConfigProgramador, tickLineas,
  type ConfigProgramador, type EstadoProgramador, type LineaProgramada,
} from "@/lib/programador";
import { cargarEstados, guardarEstados } from "@/lib/programador-estado";

// Arranque del programador de avisos del Asistente personal + estado público + mensaje de prueba.
// UN programador atiende TODAS las líneas de negocio (internet, seguridad): cada una con su servicio,
// su estado persistido y su canal. Singleton en globalThis (ver lib/app.ts). NUNCA expone el token,
// los chat ids ni mensajes de error internos: estos endpoints no tienen login todavía.

type Env = Record<string, string | undefined>;

interface Runtime {
  cfg: ConfigProgramador;
  scheduler: boolean;
  iniciado: boolean;
  corriendo: boolean;
  /** Por tenant (línea). */
  notificadores: Record<string, Notificador | undefined>;
  chats: Record<string, number>;
  estados: Record<string, EstadoProgramador>;
  ultimaPrueba: Record<string, number>;
}
const g = globalThis as unknown as { __avisos?: Runtime };

/**
 * Notificador de Telegram de una línea. Mismo bot para todas; los chats pueden ser distintos:
 * `TELEGRAM_CHAT_IDS_SEGURIDAD` (p.ej. el equipo de guardia) y, si no está, `TELEGRAM_CHAT_IDS`.
 */
export function crearNotificadorDesdeEnv(env: Env, sufijo?: string): { notificador?: Notificador; chats: number } {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const lista = (v: string | undefined) => (v ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const propios = sufijo ? lista(env[`TELEGRAM_CHAT_IDS_${sufijo}`]) : [];
  const chatIds = propios.length > 0 ? propios : lista(env.TELEGRAM_CHAT_IDS);
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
    const rt: Runtime = {
      cfg, scheduler: (env.SCHEDULER ?? "").trim().toLowerCase() === "on",
      iniciado: false, corriendo: false, notificadores: {}, chats: {}, estados: {}, ultimaPrueba: {},
    };
    for (const l of LINEAS) {
      const { notificador, chats } = crearNotificadorDesdeEnv(env, l.id === "seguridad" ? "SEGURIDAD" : undefined);
      rt.notificadores[l.tenantId] = notificador;
      rt.chats[l.tenantId] = chats;
      rt.estados[l.tenantId] = estadoVacio();
    }
    g.__avisos = rt;
  }
  return g.__avisos;
}

const ctxDe = (tenantId: string): TenantCtx => ({ tenantId, requestId: crypto.randomUUID(), now: () => new Date() });
const etiquetaDe = (tenantId: string) => {
  const l = LINEAS.find((x) => x.tenantId === tenantId);
  return l ? `${l.icono} ${l.nombre}` : tenantId;
};

/** Arranca el programador si `SCHEDULER=on` y hay canal en alguna línea. Idempotente. Lo llama `instrumentation.ts`. */
export function iniciarProgramador(env: Env = process.env): void {
  const rt = runtime(env);
  if (rt.iniciado) return;
  if (!rt.scheduler) return; // fail-closed: hay que prenderlo explícitamente
  const conCanal = LINEAS.filter((l) => rt.notificadores[l.tenantId]);
  if (conCanal.length === 0) {
    console.warn("[avisos] SCHEDULER=on pero falta TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_IDS: no se enviará nada.");
    return;
  }
  rt.iniciado = true;
  const ruta = env.ESTADO_ARCHIVO?.trim() || ".agentcore/estado-avisos.json";
  const cada = Math.max(1_000, Number(env.TICK_MS) || 60_000);

  void cargarEstados(ruta, tenantPorDefecto()).then((guardados) => {
    for (const l of LINEAS) rt.estados[l.tenantId] = guardados[l.tenantId] ?? rt.estados[l.tenantId] ?? estadoVacio();
    const s = rt.cfg.silencio ? `${rt.cfg.silencio.desde}-${rt.cfg.silencio.hasta}` : "sin franja";
    console.log(
      `[avisos] programador activo · líneas: ${conCanal.map((l) => `${l.nombre} (${rt.chats[l.tenantId]} chat${rt.chats[l.tenantId] === 1 ? "" : "s"})`).join(", ")}` +
      ` · resumen ${rt.cfg.resumenHora} · alertas ${rt.cfg.alertasCadaMin ? `cada ${rt.cfg.alertasCadaMin} min (silencio ${s}, máx. ${rt.cfg.maxAlertasDia}/día)` : "apagadas"}`,
    );

    const pulso = async () => {
      if (rt.corriendo) return; // un solo pulso a la vez
      rt.corriendo = true;
      try {
        const lineas: LineaProgramada[] = LINEAS.map((l) => ({
          tenantId: l.tenantId, etiqueta: etiquetaDe(l.tenantId), servicio: servicioDe(l.tenantId),
          estado: rt.estados[l.tenantId]!, ...(rt.notificadores[l.tenantId] ? { notificador: rt.notificadores[l.tenantId]! } : {}),
        }));
        await tickLineas(lineas, {
          cfg: rt.cfg, ahora: () => new Date(), ctx: ctxDe, log: (m) => console.error(m),
          guardar: () => guardarEstados(ruta, rt.estados).catch((e) => console.error("[avisos] no pude guardar el estado:", (e as Error).message)),
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
  linea: string;
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

export async function estadoAvisos(ctx: TenantCtx): Promise<EstadoAvisosPublico> {
  const rt = runtime();
  const agentes = await servicioDe(ctx.tenantId).listarAgentes(ctx);
  const a = agentes.find((x) => x.manifest.id === "asistente");
  const hoy = ahoraLocal(new Date(), rt.cfg.zona);
  const estado = rt.estados[ctx.tenantId] ?? estadoVacio();
  const notificador = rt.notificadores[ctx.tenantId];
  const r: EstadoAvisosPublico = {
    linea: etiquetaDe(ctx.tenantId),
    programador: !rt.scheduler ? "apagado" : notificador ? "activo" : "sin_canal",
    telegram: Boolean(notificador),
    asistenteEncendido: Boolean(a?.encendido),
    asistente: a?.persona.nombre ?? "Asistente",
    resumenHora: rt.cfg.resumenHora,
    alertasCadaMin: rt.cfg.alertasCadaMin,
    silencio: rt.cfg.silencio ? `${rt.cfg.silencio.desde}-${rt.cfg.silencio.hasta}` : null,
    enSilencioAhora: enSilencio(hoy.minutos, rt.cfg.silencio),
    maxAlertasDia: rt.cfg.maxAlertasDia,
    incluirNombres: rt.cfg.incluirNombres,
    avisosHoy: estado.avisosDia.fecha === hoy.fecha ? estado.avisosDia.n : 0,
    huboError: Boolean(estado.ultimoError),
  };
  if (estado.ultimoResumen) r.ultimoResumen = estado.ultimoResumen;
  return r;
}

export type ResultadoPrueba = { ok: true } | { ok: false; status: number; error: string };

/** Manda un mensaje de prueba por el canal de la línea (sirve aunque SCHEDULER esté apagado). Una por cada 30 s y línea. */
export async function enviarPrueba(ctx: TenantCtx): Promise<ResultadoPrueba> {
  const rt = runtime();
  const notificador = rt.notificadores[ctx.tenantId];
  if (!notificador) return { ok: false, status: 503, error: "Telegram no está configurado para esta línea: faltan TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_IDS." };
  const ahora = Date.now();
  if (ahora - (rt.ultimaPrueba[ctx.tenantId] ?? 0) < 30_000) return { ok: false, status: 429, error: "Esperá unos segundos antes de mandar otra prueba." };
  rt.ultimaPrueba[ctx.tenantId] = ahora;
  const a = (await servicioDe(ctx.tenantId).listarAgentes(ctx)).find((x) => x.manifest.id === "asistente");
  try {
    await notificador.enviar(ctx, { texto: `✅ Prueba (${etiquetaDe(ctx.tenantId)}): soy ${a?.persona.nombre ?? "tu asistente"}. Si leés esto, los avisos por Telegram funcionan.` });
    return { ok: true };
  } catch (e) {
    const msg = esError(e, "NotificadorError") ? e.message : "No pude enviar el mensaje.";
    console.error("[avisos] la prueba falló:", msg);
    return { ok: false, status: 502, error: msg };
  }
}
