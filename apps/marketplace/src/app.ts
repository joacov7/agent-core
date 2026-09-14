import type { BusinessModel, ProviderRegistry } from "@agent-core/contracts";
import { crearCoreStore, type CoreStoreEnMemoria } from "./store.js";
import { crearProviders } from "./providers.js";

/** Lo que el marketplace aporta al Core. Cadencia: transaccional_repetitivo (compra repetida). */
export interface AppMarketplace {
  store: CoreStoreEnMemoria;
  providers: ProviderRegistry;
  modeloNegocio: BusinessModel;
}

export function crearApp(): AppMarketplace {
  return {
    store: crearCoreStore(),
    providers: crearProviders(),
    modeloNegocio: "transaccional_repetitivo",
  };
}
