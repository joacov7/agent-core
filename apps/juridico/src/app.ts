import type { BusinessModel, ProviderRegistry } from "@agent-core/contracts";
import { crearCoreStore, type CoreStoreEnMemoria } from "./store.js";
import { crearProviders } from "./providers.js";

/** Lo que el estudio jurídico aporta al Core. Cadencia: proyecto (cada expediente). */
export interface AppJuridico {
  store: CoreStoreEnMemoria;
  providers: ProviderRegistry;
  modeloNegocio: BusinessModel;
}

export function crearApp(): AppJuridico {
  return {
    store: crearCoreStore(),
    providers: crearProviders(),
    modeloNegocio: "proyecto",
  };
}
