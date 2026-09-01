import type { Agent } from "@agent-core/contracts";
import { agenteTareas } from "./agentes/tareas.js";
import { agenteWhatsapp } from "./agentes/whatsapp/index.js";
import { agenteCrm } from "./agentes/crm/index.js";
import { agenteOportunidades } from "./agentes/oportunidades/index.js";
import { agenteRentabilidad } from "./agentes/rentabilidad/index.js";
import { agenteCobros } from "./agentes/cobros/index.js";
import { agenteAgenda } from "./agentes/agenda/index.js";
import { agenteInventario } from "./agentes/inventario/index.js";
import { agenteMorosidad } from "./agentes/morosidad/index.js";
import { agenteCobranzaPreventiva } from "./agentes/cobranza-preventiva/index.js";
import { agenteFlujoCaja } from "./agentes/flujo-caja/index.js";
import { agenteSeguimiento } from "./agentes/seguimiento/index.js";
import { agenteRiesgoAbandono } from "./agentes/riesgo-abandono/index.js";
import { agenteCompetencia } from "./agentes/competencia/index.js";
import { agentePrecios } from "./agentes/precios/index.js";
import { agenteCompras } from "./agentes/compras/index.js";
import { agenteLogistica } from "./agentes/logistica/index.js";
import { agenteProduccion } from "./agentes/produccion/index.js";
import { agenteCompliance } from "./agentes/compliance/index.js";
import { agentePostventa } from "./agentes/postventa/index.js";
import { agenteVentas } from "./agentes/ventas/index.js";
import { agenteProspeccion } from "./agentes/prospeccion/index.js";
import { agenteNps } from "./agentes/nps/index.js";
import { agenteRrhh } from "./agentes/rrhh/index.js";
import { agenteAnalista } from "./agentes/analista/index.js";
import { agenteCeo } from "./agentes/ceo/index.js";
import { agenteJefeGabinete } from "./agentes/jefe-gabinete/index.js";

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
  agenteCobros,
  agenteAgenda,
  agenteInventario,
  agenteMorosidad,
  agenteCobranzaPreventiva,
  agenteFlujoCaja,
  agenteSeguimiento,
  agenteRiesgoAbandono,
  agenteCompetencia,
  agentePrecios,
  agenteCompras,
  agenteLogistica,
  agenteProduccion,
  agenteCompliance,
  agentePostventa,
  agenteVentas,
  agenteProspeccion,
  agenteNps,
  agenteRrhh,
  // Dirección al final: CEO y Jefe de Gabinete resumen las recomendaciones que ya
  // produjeron los demás agentes (leídas del CoreStore).
  agenteAnalista,
  agenteCeo,
  agenteJefeGabinete,
];
