import type { ID, ISODateTime } from "../common.js";
import type { AutonomyMode } from "../autonomy.js";

/**
 * Configuración por tenant de un agente del catálogo: si está **encendido**, con qué
 * **autonomía** corre (siempre `<= manifest.autonomiaMaxima`), en qué **plan**
 * comercial se ofrece y sus ajustes de `configSchema`.
 *
 * Es la capa que decide qué corre DE VERDAD, por encima de la activación (que solo
 * dice qué está DISPONIBLE según capacidades + cadencia). Clave natural:
 * `(tenantId, agentId)`.
 */
export interface AgenteConfig {
  tenantId: ID;
  agentId: string;
  encendido: boolean;
  autonomia: AutonomyMode;
  /** Plan comercial en el que se ofrece el agente (Free/Pro/… libre por deployment). */
  plan?: string;
  /** Ajustes específicos del agente (según su `configSchema`). */
  config?: Record<string, unknown>;
  actualizadoEn?: ISODateTime;
}

/** Alta/edición antes de persistir: el store fija `tenantId` y `actualizadoEn`. */
export type AgenteConfigInput = Omit<AgenteConfig, "tenantId" | "actualizadoEn">;
