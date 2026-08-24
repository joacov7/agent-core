import type { Agent } from "@agent-core/contracts";
import { agenteTareas } from "./agentes/tareas.js";
import { agenteWhatsapp } from "./agentes/whatsapp/index.js";
import { agenteCrm } from "./agentes/crm/index.js";
import { agenteOportunidades } from "./agentes/oportunidades/index.js";
import { agenteRentabilidad } from "./agentes/rentabilidad/index.js";

/**
 * Catálogo de agentes reutilizables. El engine lo recorre y activa cada agente si
 * la app cubre su `manifest.requiereCapacidades` y su modelo de negocio (ver
 * `esActivable` / `manifestsActivables` en @agent-core/core).
 *
 * Estado de wiring:
 *   - tareas, whatsapp → run() funcional (whatsapp lee `interactions` y clasifica).
 *   - crm, oportunidades, rentabilidad → lógica portada y testeada; run() pendiente
 *     de una capa de agregación en los providers (ver el TODO de cada uno).
 */
export const catalogo: Agent[] = [
  agenteTareas,
  agenteWhatsapp,
  agenteCrm,
  agenteOportunidades,
  agenteRentabilidad,
];
