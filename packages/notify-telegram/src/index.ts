import type { MensajeNotificacion, Notificador, TenantCtx } from "@agent-core/contracts";

/**
 * Notificador por Telegram (Bot API). SOLO ENVÍA: no hay webhook ni comandos entrantes, así que
 * no expone ningún puerto y nadie puede darle órdenes al sistema por el chat.
 *
 * Seguridad: manda únicamente a los `chatIds` configurados (lista cerrada); el token nunca
 * aparece en errores ni logs (la URL lo lleva, así que los mensajes de error se construyen sin ella).
 */
export interface TelegramConfig {
  /** Token del bot (lo da @BotFather). */
  token: string;
  /** Chats autorizados a recibir avisos (tu usuario y/o un grupo). Lista cerrada. */
  chatIds: string[];
  /** Raíz de la API. Solo para tests o un Bot API propio. */
  apiBase?: string;
  timeoutMs?: number;
  /** Inyectable para tests. */
  fetch?: typeof fetch;
}

export type CausaErrorTelegram = "token_invalido" | "chat_invalido" | "limite" | "red" | "timeout" | "http" | "configuracion";

export class NotificadorError extends Error {
  constructor(
    readonly causa: CausaErrorTelegram,
    mensaje: string,
    /** Segundos que Telegram pide esperar (causa `limite`). */
    readonly reintentarEn?: number,
  ) {
    super(mensaje);
    this.name = "NotificadorError";
  }
}

/** Telegram corta los mensajes en 4096 caracteres. */
export const MAX_MENSAJE = 4096;

/** Parte un texto largo en trozos ≤ `max`, cortando en saltos de línea cuando se puede. */
export function partirMensaje(texto: string, max = MAX_MENSAJE): string[] {
  if (texto.length <= max) return [texto];
  const trozos: string[] = [];
  let resto = texto;
  while (resto.length > max) {
    let corte = resto.lastIndexOf("\n", max);
    if (corte < max / 2) corte = max; // sin salto de línea razonable: corte duro
    trozos.push(resto.slice(0, corte).trimEnd());
    resto = resto.slice(corte).trimStart();
  }
  if (resto) trozos.push(resto);
  return trozos;
}

interface RespuestaTelegram {
  ok?: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
  result?: unknown;
}

async function llamar(
  cfg: { token: string; apiBase: string; timeoutMs: number; doFetch: typeof fetch },
  metodo: string,
  cuerpo: Record<string, unknown>,
): Promise<RespuestaTelegram> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  let res: Response;
  try {
    res = await cfg.doFetch(`${cfg.apiBase}/bot${cfg.token}/${metodo}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: ctrl.signal,
    });
  } catch {
    // Ojo: el error original puede traer la URL (con el token). No se propaga su mensaje.
    if (ctrl.signal.aborted) throw new NotificadorError("timeout", `Telegram no respondió en ${Math.round(cfg.timeoutMs / 1000)} s.`);
    throw new NotificadorError("red", "No pude conectar con Telegram (revisá la conexión a internet).");
  } finally {
    clearTimeout(timer);
  }

  let json: RespuestaTelegram = {};
  try { json = (await res.json()) as RespuestaTelegram; } catch { /* cuerpo no JSON: se resuelve por el status */ }
  if (res.ok && json.ok !== false) return json;

  const status = json.error_code ?? res.status;
  if (status === 401 || status === 404) throw new NotificadorError("token_invalido", "Telegram rechazó el token del bot: revisá TELEGRAM_BOT_TOKEN.");
  if (status === 429) {
    throw new NotificadorError("limite", "Telegram pidió bajar el ritmo de mensajes.", json.parameters?.retry_after);
  }
  if (status === 400 || status === 403) {
    throw new NotificadorError("chat_invalido", `Telegram no pudo entregar el mensaje: ${(json.description ?? "chat inválido").slice(0, 160)}. ¿Le mandaste /start al bot?`);
  }
  throw new NotificadorError("http", `Telegram respondió HTTP ${status}.`);
}

export function crearNotificadorTelegram(cfg: TelegramConfig): Notificador {
  const token = cfg.token.trim();
  const chatIds = cfg.chatIds.map((c) => c.trim()).filter(Boolean);
  if (!token) throw new NotificadorError("configuracion", "Falta el token del bot de Telegram.");
  if (chatIds.length === 0) throw new NotificadorError("configuracion", "Falta al menos un chat de Telegram autorizado.");
  const base = {
    token,
    apiBase: (cfg.apiBase ?? "https://api.telegram.org").replace(/\/+$/, ""),
    timeoutMs: cfg.timeoutMs ?? 15_000,
    doFetch: cfg.fetch ?? fetch,
  };

  return {
    async enviar(_ctx: TenantCtx, mensaje: MensajeNotificacion) {
      const texto = mensaje.texto.trim();
      if (!texto) return;
      for (const chat of chatIds) {
        for (const trozo of partirMensaje(texto)) {
          await llamar(base, "sendMessage", { chat_id: chat, text: trozo, disable_web_page_preview: true });
        }
      }
    },
  };
}

export interface ChatDescubierto {
  id: string;
  tipo: string;
  nombre: string;
}

/**
 * Ayuda de configuración: lista los chats que le escribieron al bot (`getUpdates`), para que el
 * usuario obtenga su `chat_id` sin buscarlo a mano. Primero hay que mandarle /start al bot.
 */
export async function descubrirChats(cfg: { token: string; apiBase?: string; timeoutMs?: number; fetch?: typeof fetch }): Promise<ChatDescubierto[]> {
  const r = await llamar(
    { token: cfg.token.trim(), apiBase: (cfg.apiBase ?? "https://api.telegram.org").replace(/\/+$/, ""), timeoutMs: cfg.timeoutMs ?? 15_000, doFetch: cfg.fetch ?? fetch },
    "getUpdates",
    { limit: 100, timeout: 0 },
  );
  const out = new Map<string, ChatDescubierto>();
  for (const u of (Array.isArray(r.result) ? r.result : []) as { message?: { chat?: { id?: number; type?: string; first_name?: string; last_name?: string; title?: string; username?: string } } }[]) {
    const c = u.message?.chat;
    if (c?.id === undefined) continue;
    const nombre = c.title ?? ([c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || "(sin nombre)");
    out.set(String(c.id), { id: String(c.id), tipo: c.type ?? "?", nombre });
  }
  return [...out.values()];
}
