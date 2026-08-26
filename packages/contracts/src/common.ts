// Tipos base compartidos por todo el modelo canónico. Sin lógica.

/** Identificador opaco de una entidad (el adaptador decide si es uuid, int serializado, etc.). */
export type ID = string;

/** Timestamp en formato ISO-8601 (UTC). */
export type ISODateTime = string;

/**
 * Referencia genérica a cualquier entidad, del Core o del dominio.
 * Reemplaza supuestos de rubro (p. ej. `protected_products`) por `{ tipo, id }`.
 */
export interface EntityRef {
  tipo: string;
  id: ID;
}

/** Base de toda entidad canónica: identidad, tenant y auditoría mínima. */
export interface CanonicalEntity {
  id: ID;
  /** Toda fila del Core está scopeada por tenant (ver TenantCtx). No omitible. */
  tenantId: string;
  creadoEn: ISODateTime;
  actualizadoEn?: ISODateTime;
  /** Datos crudos del dominio que el adaptador quiera preservar sin tipar. */
  metadata?: Record<string, unknown>;
}

/** JSON Schema (draft 2020-12) representado de forma laxa (evita una dependencia). */
export type JsonSchema = Record<string, unknown>;
