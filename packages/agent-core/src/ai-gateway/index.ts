import type {
  AiCompletionProvider, AiRequest, AiResponse, TenantCtx,
} from "@agent-core/contracts";

/**
 * AI Gateway (motor). STUB.
 * Envuelve al `AiCompletionProvider` para aplicar presupuesto por agente/tenant y
 * registrar el gasto atribuido por tenant (lo que hoy falta en Regionales).
 */
export interface AiGateway {
  complete(ctx: TenantCtx, req: AiRequest): Promise<AiResponse>;
}

export function crearAiGateway(provider: AiCompletionProvider): AiGateway {
  return {
    complete(ctx, req) {
      // TODO: chequear presupuesto (agente/tenant) y registrar gasto tras responder.
      return provider.complete(ctx, req);
    },
  };
}
