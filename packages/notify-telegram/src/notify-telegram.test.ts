import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import { crearNotificadorTelegram, descubrirChats, NotificadorError, partirMensaje, MAX_MENSAJE } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
const TOKEN = "123456:ABC-secreto";

function fetchFalso(respuesta: (url: string, body: Record<string, unknown>) => Response | Promise<Response>) {
  const llamadas: { url: string; body: Record<string, unknown> }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    llamadas.push({ url, body });
    return respuesta(url, body);
  }) as unknown as typeof fetch;
  return { f, llamadas };
}
const ok = (extra: object = {}) => new Response(JSON.stringify({ ok: true, ...extra }), { status: 200 });
const err = (status: number, description: string, extra: object = {}) =>
  new Response(JSON.stringify({ ok: false, error_code: status, description, ...extra }), { status });

describe("notificador Telegram", () => {
  it("manda el texto a cada chat autorizado, sin vista previa de links", async () => {
    const { f, llamadas } = fetchFalso(() => ok());
    const n = crearNotificadorTelegram({ token: ` ${TOKEN} `, chatIds: ["111", " 222 ", ""], fetch: f });
    await n.enviar(ctx, { texto: "  Hola  " });
    expect(llamadas.map((l) => l.body)).toEqual([
      { chat_id: "111", text: "Hola", disable_web_page_preview: true },
      { chat_id: "222", text: "Hola", disable_web_page_preview: true },
    ]);
    expect(llamadas[0]!.url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
  });

  it("texto vacío no manda nada; sin token o sin chats falla al crear", async () => {
    const { f, llamadas } = fetchFalso(() => ok());
    await crearNotificadorTelegram({ token: TOKEN, chatIds: ["1"], fetch: f }).enviar(ctx, { texto: "   " });
    expect(llamadas).toHaveLength(0);
    expect(() => crearNotificadorTelegram({ token: " ", chatIds: ["1"] })).toThrow(NotificadorError);
    expect(() => crearNotificadorTelegram({ token: TOKEN, chatIds: [" "] })).toThrow(/chat/);
  });

  it("parte los mensajes largos en trozos de ≤4096, preferentemente en saltos de línea", async () => {
    const lineas = Array.from({ length: 300 }, (_, i) => `línea ${i} ${"x".repeat(30)}`).join("\n");
    const trozos = partirMensaje(lineas);
    expect(trozos.length).toBeGreaterThan(1);
    expect(trozos.every((t) => t.length <= MAX_MENSAJE)).toBe(true);
    expect(trozos.join("\n").replace(/\s+/g, " ")).toBe(lineas.replace(/\s+/g, " ")); // no pierde texto
    expect(trozos[0]!.endsWith("x")).toBe(true); // cortó en un borde de línea
    expect(partirMensaje("y".repeat(MAX_MENSAJE * 2 + 5)).map((t) => t.length)).toEqual([MAX_MENSAJE, MAX_MENSAJE, 5]);
  });

  it("errores tipados y el token NUNCA aparece en el mensaje", async () => {
    const caso = async (r: () => Response | Promise<Response>) => {
      const n = crearNotificadorTelegram({ token: TOKEN, chatIds: ["1"], fetch: fetchFalso(r).f });
      return n.enviar(ctx, { texto: "x" }).catch((e: NotificadorError) => e);
    };
    expect(await caso(() => err(401, "Unauthorized"))).toMatchObject({ causa: "token_invalido" });
    expect(await caso(() => err(400, "Bad Request: chat not found"))).toMatchObject({ causa: "chat_invalido" });
    expect((await caso(() => err(403, "Forbidden: bot was blocked by the user")) as NotificadorError).message).toContain("/start");
    expect(await caso(() => err(429, "Too Many Requests", { parameters: { retry_after: 7 } }))).toMatchObject({ causa: "limite", reintentarEn: 7 });
    expect(await caso(() => err(502, "Bad Gateway"))).toMatchObject({ causa: "http" });

    const caido = await caso(() => { throw new TypeError(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`); });
    expect(caido).toMatchObject({ causa: "red" });
    for (const e of [await caso(() => err(401, "x")), caido, await caso(() => err(429, "x")), await caso(() => err(500, "x"))]) {
      expect((e as Error).message).not.toContain("secreto");
      expect((e as Error).message).not.toContain(TOKEN);
    }
  });

  it("timeout", async () => {
    const colgado = (async (_u: string, init: RequestInit) =>
      new Promise((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    const n = crearNotificadorTelegram({ token: TOKEN, chatIds: ["1"], timeoutMs: 20, fetch: colgado });
    expect(await n.enviar(ctx, { texto: "x" }).catch((e) => e)).toMatchObject({ causa: "timeout" });
  });

  it("descubrirChats lista quién le escribió al bot, sin repetir", async () => {
    const { f, llamadas } = fetchFalso(() => ok({
      result: [
        { message: { chat: { id: 111, type: "private", first_name: "Joaquín", last_name: "V" } } },
        { message: { chat: { id: 111, type: "private", first_name: "Joaquín", last_name: "V" } } }, // mismo chat: no se repite
        { message: { chat: { id: -100222, type: "supergroup", title: "Equipo" } } },
        { edited_message: {} },
      ],
    }));
    expect(await descubrirChats({ token: TOKEN, fetch: f })).toEqual([
      { id: "111", tipo: "private", nombre: "Joaquín V" },
      { id: "-100222", tipo: "supergroup", nombre: "Equipo" },
    ]);
    expect(llamadas[0]!.url).toContain("/getUpdates");
  });
});
