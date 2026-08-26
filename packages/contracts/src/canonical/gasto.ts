import type { CanonicalEntity } from "../common.js";

/**
 * Registro de gasto de IA, ATRIBUIDO por tenant y (opcional) por agente. Es la base
 * de la responsabilidad del Core de "atribuir gasto de IA por tenant" (sección 8).
 * Lo produce el AI Gateway tras cada llamada al proveedor.
 */
export interface GastoIA extends CanonicalEntity {
  agentId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Costo derivado del tarifario, en su moneda. 0 si no hay tarifario. */
  costo: number;
  moneda?: string;
  /** Traza de la ejecución que originó el gasto (TenantCtx.requestId). */
  requestId?: string;
}

/** Gasto recién producido, antes de que el `GastoStore` le asigne id/tenant/timestamps. */
export type GastoIANuevo = Omit<
  GastoIA,
  "id" | "tenantId" | "creadoEn" | "actualizadoEn"
>;
