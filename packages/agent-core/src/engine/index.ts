import type {
  Agent, AgentContext, AgentRunOutput, TenantCtx, ProviderRegistry, CoreStore,
} from "@agent-core/contracts";

/**
 * Punto de entrada al Core. FALLA CERRADO sin TenantCtx: sin tenant no ejecuta
 * (sección 8 del documento de arquitectura).
 *
 * STUB: hoy solo valida el tenant, arma el AgentContext y delega en `agent.run`.
 * Pendiente (próxima fase, con los .logic portados):
 *   - activación por manifest (capacidades ⊇ requeridas, modelo de negocio),
 *   - enforcement de políticas + autonomía sobre tools de escritura,
 *   - AI gateway (presupuesto/atribución por tenant),
 *   - persistencia de recomendaciones vía CoreStore y arranque del bucle.
 */
export interface RunAgentInput {
  agent: Agent;
  ctx: TenantCtx;
  providers: ProviderRegistry;
  store: CoreStore;
  config?: Record<string, unknown>;
}

export async function runAgent(input: RunAgentInput): Promise<AgentRunOutput> {
  if (!input.ctx?.tenantId) {
    throw new Error(
      "TenantCtx obligatorio: el Core no ejecuta sin tenant (falla cerrado).",
    );
  }
  const context: AgentContext = {
    ctx: input.ctx,
    providers: input.providers,
    store: input.store,
    config: input.config ?? {},
  };
  return input.agent.run(context);
}
