import { describe, it, expect } from "vitest";
import type { TenantCtx } from "@agent-core/contracts";
import { crearAiProviderOpenAiCompat, ProveedorIAError } from "./index.js";

const ctx: TenantCtx = { tenantId: "t1" };
const msgs = [{ role: "user" as const, content: "hola" }];

function fetchFalso(respuesta: () => Response | Promise<Response>) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return respuesta();
  }) as unknown as typeof fetch;
  return { f, llamadas };
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("ai-openai (OpenAI-compatible)", () => {
  it("arma el request, normaliza la baseUrl y lee texto + uso", async () => {
    const { f, llamadas } = fetchFalso(() =>
      ok({ model: "qwen2.5:1.5b", choices: [{ message: { content: "Hola!" } }], usage: { prompt_tokens: 12, completion_tokens: 3 } }));
    const ai = crearAiProviderOpenAiCompat({ baseUrl: "http://localhost:11434/v1/", model: "qwen2.5:1.5b", apiKey: "sk-secreto", fetch: f });

    const r = await ai.complete(ctx, { messages: msgs, maxTokens: 50, temperature: 0.2 });
    expect(r).toEqual({ text: "Hola!", model: "qwen2.5:1.5b", usage: { inputTokens: 12, outputTokens: 3 } });

    expect(llamadas[0]!.url).toBe("http://localhost:11434/v1/chat/completions");
    const body = JSON.parse(String(llamadas[0]!.init.body));
    expect(body).toMatchObject({ model: "qwen2.5:1.5b", stream: false, max_tokens: 50, temperature: 0.2, messages: msgs });
    expect((llamadas[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer sk-secreto");
    expect(JSON.stringify(body)).not.toContain("t1"); // el tenant no se manda al proveedor
  });

  it("un AiRequest.model pisa el default; sin apiKey no manda Authorization; sin usage estima", async () => {
    const { f, llamadas } = fetchFalso(() => ok({ choices: [{ message: { content: "12345678" } }] }));
    const ai = crearAiProviderOpenAiCompat({ baseUrl: "http://x/v1", model: "a", fetch: f });
    const r = await ai.complete(ctx, { messages: msgs, model: "b" });
    expect(JSON.parse(String(llamadas[0]!.init.body)).model).toBe("b");
    expect((llamadas[0]!.init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(r.model).toBe("b");
    expect(r.usage.outputTokens).toBe(2);
    expect(r.usage.inputTokens).toBeGreaterThan(0);
  });

  it("servidor caído → inalcanzable (con la baseUrl, sin la apiKey)", async () => {
    const { f } = fetchFalso(() => { throw new TypeError("fetch failed"); });
    const ai = crearAiProviderOpenAiCompat({ baseUrl: "http://localhost:11434/v1", model: "m", apiKey: "sk-secreto", fetch: f });
    const err = await ai.complete(ctx, { messages: msgs }).catch((e) => e);
    expect(err).toBeInstanceOf(ProveedorIAError);
    expect(err.causa).toBe("inalcanzable");
    expect(err.message).toContain("localhost:11434");
    expect(err.message).not.toContain("sk-secreto");
  });

  it("HTTP de error y respuesta rara → errores tipados", async () => {
    const e500 = crearAiProviderOpenAiCompat({ baseUrl: "http://x/v1", model: "m", fetch: fetchFalso(() => new Response("model not found", { status: 404 })).f });
    expect(await e500.complete(ctx, { messages: msgs }).catch((e) => e)).toMatchObject({ causa: "http", status: 404 });

    const raro = crearAiProviderOpenAiCompat({ baseUrl: "http://x/v1", model: "m", fetch: fetchFalso(() => ok({ choices: [] })).f });
    expect(await raro.complete(ctx, { messages: msgs }).catch((e) => e)).toMatchObject({ causa: "respuesta_invalida" });

    const noJson = crearAiProviderOpenAiCompat({ baseUrl: "http://x/v1", model: "m", fetch: fetchFalso(() => new Response("<html>", { status: 200 })).f });
    expect(await noJson.complete(ctx, { messages: msgs }).catch((e) => e)).toMatchObject({ causa: "respuesta_invalida" });
  });

  it("timeout → causa timeout", async () => {
    const colgado = (async (_u: string, init: RequestInit) =>
      new Promise((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    const ai = crearAiProviderOpenAiCompat({ baseUrl: "http://x/v1", model: "m", timeoutMs: 20, fetch: colgado });
    expect(await ai.complete(ctx, { messages: msgs }).catch((e) => e)).toMatchObject({ causa: "timeout" });
  });
});
