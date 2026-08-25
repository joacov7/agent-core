import type { AiCompletionProvider } from "@agent-core/contracts";

/**
 * Mock de proveedor de IA (el proveedor concreto —Anthropic u otro— vive en la app,
 * fuera del Core). Devuelve un texto fijo y un uso de tokens plausible para que el
 * AI Gateway pueda calcular y atribuir el costo.
 */
export function crearAiProviderMock(): AiCompletionProvider {
  return {
    async complete(_ctx, req) {
      const ultimo = req.messages[req.messages.length - 1]?.content ?? "";
      return {
        text: `Respuesta redactada para: ${ultimo.slice(0, 40)}`,
        model: req.model ?? "mock-1",
        usage: { inputTokens: 500, outputTokens: 200 },
      };
    },
  };
}

/** Tarifario de referencia para el mock. */
export const TARIFARIO_MOCK = { "mock-1": { entradaPor1k: 0.003, salidaPor1k: 0.015 } };
