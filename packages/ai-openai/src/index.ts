import type { AiCompletionProvider, AiResponse } from "@agent-core/contracts";

/**
 * Proveedor de IA para cualquier servidor con la API `POST {baseUrl}/chat/completions`
 * de OpenAI: Ollama (`http://localhost:11434/v1`), llama.cpp, vLLM, LM Studio, OpenAI…
 * Así el mismo código corre con un modelo local gratis o con uno pago: cambia solo la
 * config. Sin dependencias (usa `fetch`).
 *
 * El Core nunca lo importa: la app lo inyecta y el AI Gateway lo envuelve para
 * presupuesto y atribución de gasto.
 */
export interface OpenAiCompatConfig {
  /** Raíz de la API, p.ej. `http://localhost:11434/v1`. */
  baseUrl: string;
  /** Modelo por defecto (un `AiRequest.model` lo pisa). */
  model: string;
  /** Bearer token. Ollama y la mayoría de los locales no lo piden. */
  apiKey?: string;
  /** Tiempo máximo por llamada. Por defecto 120 s (un modelo chico en CPU es lento). */
  timeoutMs?: number;
  /** Inyectable para tests. */
  fetch?: typeof fetch;
}

export type CausaErrorIA = "inalcanzable" | "timeout" | "http" | "respuesta_invalida";

/** Falla del proveedor de IA (el mensaje nunca incluye la apiKey). */
export class ProveedorIAError extends Error {
  constructor(
    readonly causa: CausaErrorIA,
    mensaje: string,
    readonly status?: number,
  ) {
    super(mensaje);
    this.name = "ProveedorIAError";
  }
}

interface ChatCompletionBody {
  choices?: { message?: { content?: unknown } }[];
  model?: unknown;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
}

/** Estimación gruesa (≈4 caracteres por token) para servidores que no informan `usage`. */
const estimarTokens = (texto: string) => Math.ceil(texto.length / 4);

export function crearAiProviderOpenAiCompat(cfg: OpenAiCompatConfig): AiCompletionProvider {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const doFetch = cfg.fetch ?? fetch;
  const timeoutMs = cfg.timeoutMs ?? 120_000;

  return {
    async complete(_ctx, req): Promise<AiResponse> {
      const model = req.model ?? cfg.model;
      const body = {
        model,
        messages: req.messages,
        stream: false,
        ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      };

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let res: Response;
      try {
        res = await doFetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } catch (e) {
        if (ctrl.signal.aborted) {
          throw new ProveedorIAError("timeout", `El modelo no respondió en ${Math.round(timeoutMs / 1000)} s (${base}).`);
        }
        const motivo = e instanceof Error ? e.message : String(e);
        throw new ProveedorIAError("inalcanzable", `No pude conectar con el modelo en ${base}: ${motivo}`);
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const detalle = (await res.text().catch(() => "")).slice(0, 300);
        throw new ProveedorIAError("http", `El modelo respondió HTTP ${res.status}${detalle ? `: ${detalle}` : ""}`, res.status);
      }

      let json: ChatCompletionBody;
      try {
        json = (await res.json()) as ChatCompletionBody;
      } catch {
        throw new ProveedorIAError("respuesta_invalida", "La respuesta del modelo no es JSON válido.");
      }
      const texto = json.choices?.[0]?.message?.content;
      if (typeof texto !== "string") {
        throw new ProveedorIAError("respuesta_invalida", "La respuesta del modelo no trae `choices[0].message.content`.");
      }

      const entrada = json.usage?.prompt_tokens;
      const salida = json.usage?.completion_tokens;
      return {
        text: texto,
        model: typeof json.model === "string" && json.model ? json.model : model,
        usage: {
          inputTokens: typeof entrada === "number" ? entrada : estimarTokens(req.messages.map((m) => m.content).join("\n")),
          outputTokens: typeof salida === "number" ? salida : estimarTokens(texto),
        },
      };
    },
  };
}
