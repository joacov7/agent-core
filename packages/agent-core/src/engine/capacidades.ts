import type { CapabilityId, ProviderRegistry } from "@agent-core/contracts";

// Mapea cada clave de provider a la capacidad que aporta. `interactions` es parte
// de la capacidad `contacts`; `ai` no es una capacidad de dominio.
const MAPA_CAPACIDAD: Record<string, CapabilityId> = {
  contacts: "contacts",
  interactions: "contacts",
  transactions: "transactions",
  receivables: "receivables",
  catalog: "catalog",
  inventory: "inventory",
  agenda: "agenda",
  pipeline: "pipeline",
  documents: "documents",
  competition: "competition",
  suppliers: "suppliers",
  production: "production",
  logistics: "logistics",
  externalSources: "external-sources",
  feedback: "feedback",
  staff: "staff",
};

/**
 * Deriva las capacidades disponibles de qué providers están presentes
 * (auto-descubrible, sección 6). El Core no las declara: las descubre.
 */
export function capacidadesDeProviders(providers: ProviderRegistry): CapabilityId[] {
  const bag = providers as Record<string, unknown>;
  const capacidades = new Set<CapabilityId>();
  for (const clave of Object.keys(bag)) {
    const cap = MAPA_CAPACIDAD[clave];
    if (cap && bag[clave]) capacidades.add(cap);
  }
  return [...capacidades];
}
