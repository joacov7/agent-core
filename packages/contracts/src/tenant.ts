import type { ID } from "./common.js";

/** Quién origina la ejecución: un usuario humano, el propio agente o el sistema. */
export interface Actor {
  tipo: "usuario" | "agente" | "sistema";
  id: ID;
  nombre?: string;
}

/**
 * Contexto de tenant OBLIGATORIO. Sin TenantCtx el Core no ejecuta (falla cerrado).
 *
 * La app lo resuelve desde su auth (sesión/JWT/subdominio); el Core nunca lo infiere
 * ni default-ea. Viaja a `runAgent`, a cada provider, a cada tool y a cada tabla del
 * Core. El aislamiento entre empresas depende de que `tenantId` sea correcto y no
 * omitible: por eso vive en el tipo y no puede faltar.
 */
export interface TenantCtx {
  tenantId: string;
  /** Actor que origina la ejecución (para atribución de gasto y enforcement). */
  actor?: Actor;
  /** Id de traza para correlacionar logs y gasto de IA dentro de una ejecución. */
  requestId?: string;
  /** Locale para redacción de textos por IA (ej. "es-AR"). */
  locale?: string;
  /** Reloj inyectable (tests/determinismo). Default de facto: () => new Date(). */
  now?: () => Date;
}
