import type { TenantCtx } from "../tenant.js";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequest {
  messages: AiMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Agente que origina la llamada (para presupuesto y atribución de gasto). */
  agentId?: string;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiResponse {
  text: string;
  model: string;
  usage: AiUsage;
}

/**
 * Puerto al proveedor de IA. El AI Gateway del Core lo envuelve para atribuir gasto
 * y aplicar presupuesto por agente y por tenant. Recibe SIEMPRE TenantCtx (la
 * atribución de gasto por tenant depende de eso).
 */
export interface AiCompletionProvider {
  complete(ctx: TenantCtx, req: AiRequest): Promise<AiResponse>;
}
