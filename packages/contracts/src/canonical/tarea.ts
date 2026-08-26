import type { CanonicalEntity, EntityRef, ID, ISODateTime } from "../common.js";

export type EstadoTarea = "pendiente" | "en_progreso" | "completada" | "cancelada";

/**
 * Capa 1 — universal alta. Unidad de trabajo o hecho registrado.
 * `refEntidad` la ata a cualquier entidad del Core o del dominio.
 */
export interface Tarea extends CanonicalEntity {
  tipo: string;
  titulo: string;
  estado: EstadoTarea;
  descripcion?: string;
  asignadoA?: ID;
  venceEn?: ISODateTime;
  refEntidad?: EntityRef;
}
