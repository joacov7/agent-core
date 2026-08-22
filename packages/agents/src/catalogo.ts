import type { Agent } from "@agent-core/contracts";
import { agenteTareas } from "./agentes/tareas.js";

/**
 * Catálogo de agentes reutilizables. El engine lo recorre y activa cada agente si
 * la app cubre su `manifest.requiereCapacidades` (y modelo de negocio, si aplica).
 *
 * Hoy trae solo el agente de ejemplo. El catálogo completo (CEO, Jefe de Gabinete,
 * Cobros, CRM, Rentabilidad, WhatsApp, etc.) se agrega en la próxima fase.
 */
export const catalogo: Agent[] = [agenteTareas];
