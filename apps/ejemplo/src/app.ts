import type { BusinessModel, ProviderRegistry, WriteToolHandler } from "@agent-core/contracts";
import { crearAiGateway, type AiGateway } from "@agent-core/core";
import { crearCoreStore, type CoreStoreEnMemoria } from "./store.js";
import { crearProviders } from "./providers.js";
import { crearAiProviderMock, TARIFARIO_MOCK } from "./ai.js";
import { crearTools, type Outbox } from "./tools.js";

/** Todo lo que la app aporta al Core: providers, store, gateway, tools de escritura. */
export interface AppEjemplo {
  store: CoreStoreEnMemoria;
  providers: ProviderRegistry;
  gateway: AiGateway;
  tools: Record<string, WriteToolHandler>;
  outbox: Outbox;
  modeloNegocio: BusinessModel;
}

export function crearApp(): AppEjemplo {
  const store = crearCoreStore();
  const outbox: Outbox = { whatsapp: [], tareas: [] };
  const gateway = crearAiGateway({
    provider: crearAiProviderMock(),
    tarifario: TARIFARIO_MOCK,
    gastoStore: store.gastoIA,
    presupuesto: { maxPorTenant: 1 }, // USD 1 por tenant
    moneda: "USD",
  });
  return {
    store,
    providers: crearProviders(),
    gateway,
    tools: crearTools(outbox),
    outbox,
    modeloNegocio: "transaccional_repetitivo",
  };
}
