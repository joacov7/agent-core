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
 * Estado de wiring: todos con run() funcional.
 *   - whatsapp → lee `interactions` y clasifica.
 *   - crm / oportunidades / rentabilidad → consumen los agregados analíticos
 *     opcionales de los providers (resumenPorContacto, paresComplementarios /
 *     canastasPorContacto, resumenRentabilidad). Si el adaptador no los expone,
 *     devuelven vacío con una nota.
 */
export const catalogo: Agent[] = [
  agenteTareas,
  agenteWhatsapp,
  agenteCrm,
  agenteOportunidades,
  agenteRentabilidad,
];
