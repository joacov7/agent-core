import type { AutonomyMode } from "@agent-core/contracts";

/**
 * Policies / Enforcement (motor). STUB.
 * Aquí migran `policies.logic.ts` (resolvePolicy, evaluar) casi tal cual, con un
 * cambio del documento: `protected_products`/`protected_clients` se generalizan a
 * `protectedEntities: EntityRef[]`. El enforcement intercepta TODA tool de
 * escritura (core o dominio) antes de ejecutarla.
 */
export interface DecisionEnforcement {
  permitido: boolean;
  requiereAprobacion: boolean;
  motivo?: string;
}

/** Placeholder: default seguro = permite y solo pide aprobación si no es autónomo. */
export function evaluarAccion(autonomia: AutonomyMode): DecisionEnforcement {
  return { permitido: true, requiereAprobacion: autonomia !== "autonomous" };
}
