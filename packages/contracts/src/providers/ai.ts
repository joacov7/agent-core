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

/** Costo de un modelo por cada 1000 tokens (en la moneda del tarifario). */
export interface CostoModeloIA {
  entradaPor1k: number;
  salidaPor1k: number;
}

/** Tarifario: modelo → costo. El gateway lo usa para derivar el costo desde los tokens. */
export type TarifarioIA = Record<string, CostoModeloIA>;

/**
 * Presupuesto de IA. Topes de gasto acumulado (en la moneda del tarifario) por
 * tenant y, opcionalmente, por agente. El gateway falla cerrado al superarlos.
 */
export interface PresupuestoIA {
  maxPorTenant?: number;
  maxPorAgente?: Record<string, number>;
}
