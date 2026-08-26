import type { CoreStore, Impacto, ImpactoNuevo, TenantCtx } from "@agent-core/contracts";
import { relojPorDefecto, generarIdPorDefecto, type Reloj, type GenerarId } from "./ids.js";

/**
 * Registra un impacto medido — el paso Resultado → Impacto del bucle. Persiste en
 * `impacts` vía CoreStore, asignando id/tenant/creado y, si falta, `medidoEn` con
 * el reloj. Es el efecto REAL, comparable contra el `valorEsperado` de la reco.
 */
export interface ImpactoDeps { now?: Reloj; generarId?: GenerarId }

export function registrarImpacto(
  store: CoreStore, ctx: TenantCtx, impacto: ImpactoNuevo, deps?: ImpactoDeps,
): Promise<Impacto> {
  if (!ctx?.tenantId) {
    throw new Error("TenantCtx obligatorio: el Core no registra impacto sin tenant (falla cerrado).");
  }
  const now = deps?.now ?? relojPorDefecto;
  const genId = deps?.generarId ?? generarIdPorDefecto;
  return store.impacts.save(ctx, {
    ...impacto,
    id: genId(),
    tenantId: ctx.tenantId,
    creadoEn: now().toISOString(),
    medidoEn: impacto.medidoEn ?? now().toISOString(),
  });
}
