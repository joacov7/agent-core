import type { CanonicalEntity, ID, ISODateTime } from "../common.js";

export type CanalInteraccion =
  | "email" | "telefono" | "whatsapp" | "sms" | "presencial" | "otro";

export type DireccionInteraccion = "entrante" | "saliente";

/**
 * Capa 1 — universal total. Comunicación con un contacto (entrante o saliente).
 * La taxonomía de "intención" (sales-flavored en Regionales) NO vive acá: es un
 * clasificador configurable por vertical, no parte del canónico.
 */
export interface Interaccion extends CanonicalEntity {
  contactoId: ID;
  canal: CanalInteraccion;
  direccion: DireccionInteraccion;
  texto?: string;
  fecha: ISODateTime;
  /** Tarea/actividad asociada, si la interacción nace o cierra una. */
  tareaId?: ID;
}
