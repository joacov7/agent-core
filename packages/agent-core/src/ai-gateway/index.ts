import type {
  AiCompletionProvider, AiRequest, AiResponse, AiUsage,
  GastoStore, PresupuestoIA, TarifarioIA, TenantCtx,
} from "@agent-core/contracts";
import { relojPorDefecto, generarIdPorDefecto, type Reloj, type GenerarId } from "../engine/ids.js";

/**
 * AI Gateway: envuelve al `AiCompletionProvider` para
 *   1) aplicar PRESUPUESTO por tenant y por agente (falla cerrado al superarlo), y
 *   2) ATRIBUIR el gasto por tenant/agente (lo que hoy falta en Regionales).
 * El proveedor concreto (Anthropic, etc.) queda fuera del Core: el gateway es
 * agnóstico y solo contabiliza.
 */

/** Costo (en la moneda del tarifario) de un uso de tokens contra un modelo. */
export function calcularCosto(
  model: string, usage: AiUsage, tarifario?: TarifarioIA,
): number {
  const t = tarifario?.[model];
  if (!t) return 0;
  const costo = (usage.inputTokens / 1000) * t.entradaPor1k
    + (usage.outputTokens / 1000) * t.salidaPor1k;
  return Math.round(costo * 1e6) / 1e6;
}

/** Se superó el presupuesto de IA (por tenant o por agente). */
export class PresupuestoExcedidoError extends Error {
  constructor(
    readonly ambito: "tenant" | "agente",
    readonly limite: number,
    readonly gastado: number,
    readonly agentId?: string,
  ) {
    const quien = ambito === "agente" ? `agente "${agentId}"` : "tenant";
    super(`Presupuesto de IA excedido para ${quien}: gastado ${gastado} >= límite ${limite}.`);
    this.name = "PresupuestoExcedidoError";
  }
}

export interface AiGatewayConfig {
  provider: AiCompletionProvider;
  /** Para derivar el costo desde los tokens. Sin tarifario, el costo es 0. */
  tarifario?: TarifarioIA;
  /** Topes de gasto acumulado. Sin presupuesto, no se bloquea nada. */
  presupuesto?: PresupuestoIA;
  /** Persiste/consulta el gasto. Sin store, el gateway usa un acumulador en memoria. */
  gastoStore?: GastoStore;
  moneda?: string;
  now?: Reloj;
  generarId?: GenerarId;
}

export interface AiGateway {
  complete(ctx: TenantCtx, req: AiRequest): Promise<AiResponse>;
}

export function crearAiGateway(config: AiGatewayConfig): AiGateway {
  const now = config.now ?? relojPorDefecto;
  const genId = config.generarId ?? generarIdPorDefecto;

  // Acumulador en memoria (fallback cuando no hay gastoStore): total por tenant y por tenant:agente.
  const memTenant = new Map<string, number>();
  const memAgente = new Map<string, number>();
  const keyAgente = (tenantId: string, agentId: string) => `${tenantId}::${agentId}`;

  async function gastadoTenant(ctx: TenantCtx): Promise<number> {
    if (config.gastoStore) return config.gastoStore.totalPorTenant(ctx);
    return memTenant.get(ctx.tenantId) ?? 0;
  }
  async function gastadoAgente(ctx: TenantCtx, agentId: string): Promise<number> {
    if (config.gastoStore) return config.gastoStore.totalPorAgente(ctx, agentId);
    return memAgente.get(keyAgente(ctx.tenantId, agentId)) ?? 0;
  }

  async function verificarPresupuesto(ctx: TenantCtx, agentId?: string): Promise<void> {
    const p = config.presupuesto;
    if (!p) return;
    if (p.maxPorTenant != null) {
      const g = await gastadoTenant(ctx);
      if (g >= p.maxPorTenant) throw new PresupuestoExcedidoError("tenant", p.maxPorTenant, g);
    }
    if (agentId && p.maxPorAgente) {
      const limite = p.maxPorAgente[agentId];
      if (limite != null) {
        const g = await gastadoAgente(ctx, agentId);
        if (g >= limite) throw new PresupuestoExcedidoError("agente", limite, g, agentId);
      }
    }
  }

  return {
    async complete(ctx, req) {
      if (!ctx?.tenantId) {
        throw new Error("TenantCtx obligatorio: el AI Gateway no llama al proveedor sin tenant (falla cerrado).");
      }
      const agentId = req.agentId;

      // 1) Presupuesto (pre-check contra lo ya acumulado).
      await verificarPresupuesto(ctx, agentId);

      // 2) Llamada al proveedor.
      const res = await config.provider.complete(ctx, req);

      // 3) Costo + atribución del gasto.
      const costo = calcularCosto(res.model, res.usage, config.tarifario);
      memTenant.set(ctx.tenantId, (memTenant.get(ctx.tenantId) ?? 0) + costo);
      if (agentId) {
        const k = keyAgente(ctx.tenantId, agentId);
        memAgente.set(k, (memAgente.get(k) ?? 0) + costo);
      }
      if (config.gastoStore) {
        await config.gastoStore.registrar(ctx, {
          id: genId(),
          tenantId: ctx.tenantId,
          creadoEn: now().toISOString(),
          ...(agentId ? { agentId } : {}),
          model: res.model,
          inputTokens: res.usage.inputTokens,
          outputTokens: res.usage.outputTokens,
          costo,
          ...(config.moneda ? { moneda: config.moneda } : {}),
          ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        });
      }

      return res;
    },
  };
}
