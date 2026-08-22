import type {
  ContactsProvider, InteractionsProvider, TransactionsProvider, ReceivablesProvider,
  CatalogProvider, InventoryProvider, AgendaProvider, PipelineProvider,
  DocumentsProvider, CompetitionProvider, SuppliersProvider, ProductionProvider,
  LogisticsProvider,
} from "./capability-providers.js";
import type { AiCompletionProvider } from "./ai.js";

/**
 * Bolsa de providers que la app inyecta al Core. Todos opcionales: el Core deriva
 * las capacidades disponibles de qué claves están presentes (auto-descubrible), y
 * activa un agente solo si su `requiereCapacidades` está cubierto.
 */
export interface ProviderRegistry {
  contacts?: ContactsProvider;
  interactions?: InteractionsProvider;
  transactions?: TransactionsProvider;
  receivables?: ReceivablesProvider;
  catalog?: CatalogProvider;
  inventory?: InventoryProvider;
  agenda?: AgendaProvider;
  pipeline?: PipelineProvider;
  documents?: DocumentsProvider;
  competition?: CompetitionProvider;
  suppliers?: SuppliersProvider;
  production?: ProductionProvider;
  logistics?: LogisticsProvider;
  /** Proveedor de IA (lo usan los agentes con nivelIA != "ninguno"). */
  ai?: AiCompletionProvider;
}
