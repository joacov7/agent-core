import type { CoreStore } from "@agent-core/contracts";
import { crearAiProviderOpenAiCompat } from "@agent-core/ai-openai";
import { crearAiGateway, type AiGateway } from "@agent-core/core";
import { crearAiProviderMock } from "@agent-core/app-ejemplo";

/**
 * IA del chat, configurada por variables de entorno (ver `.env.example`):
 *   AI_PROVIDER      "openai-compat" (default: Ollama local u otra API tipo OpenAI) | "mock" | "off"
 *   AI_BASE_URL      default http://localhost:11434/v1  (Ollama)
 *   AI_MODEL         default qwen2.5:1.5b               (entra en ~2 GB de RAM, sin GPU)
 *   AI_API_KEY       opcional (los modelos locales no la piden)
 *   AI_COST_IN_1K / AI_COST_OUT_1K   costo por 1000 tokens (default 0: local = gratis)
 *   AI_BUDGET_TENANT tope de gasto acumulado por tenant (sin definir = sin tope)
 * Siempre pasa por el AI Gateway: presupuesto + atribución de gasto por tenant y agente.
 */
type Env = Record<string, string | undefined>;

const num = (v: string | undefined) => {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function crearIA(env: Env, store: CoreStore): AiGateway | undefined {
  const modo = (env.AI_PROVIDER ?? "openai-compat").trim().toLowerCase();
  if (modo === "off") return undefined;

  const model = env.AI_MODEL?.trim() || "qwen2.5:1.5b";
  const provider = modo === "mock"
    ? crearAiProviderMock()
    : crearAiProviderOpenAiCompat({
        baseUrl: env.AI_BASE_URL?.trim() || "http://localhost:11434/v1",
        model,
        ...(env.AI_API_KEY ? { apiKey: env.AI_API_KEY } : {}),
      });

  const tope = num(env.AI_BUDGET_TENANT);
  return crearAiGateway({
    provider,
    tarifario: { [model]: { entradaPor1k: num(env.AI_COST_IN_1K) ?? 0, salidaPor1k: num(env.AI_COST_OUT_1K) ?? 0 } },
    ...(tope !== undefined ? { presupuesto: { maxPorTenant: tope } } : {}),
    ...(store.gastoIA ? { gastoStore: store.gastoIA } : {}),
  });
}
