import type { CanonicalEntity } from "../common.js";
import type { BusinessModel } from "./cadencia.js";

export type CanalContacto = "email" | "telefono" | "whatsapp" | "otro";

/** Un medio de contacto tipado (alternativa estructurada a emails[]/telefonos[]). */
export interface MedioContacto {
  canal: CanalContacto;
  valor: string;
  etiqueta?: string;
  principal?: boolean;
}

/**
 * Capa 1 — universal total. Persona u organización con la que el negocio se relaciona.
 * Único ancla del grafo que casi ningún agente puede ignorar.
 */
export interface Contacto extends CanonicalEntity {
  nombre: string;
  emails?: string[];
  telefonos?: string[];
  /** Medios estructurados (opcional; complementa emails/telefonos). */
  medios?: MedioContacto[];
  tags?: string[];
  /** Rol dentro del negocio (cliente, proveedor, comitente, comitido...). Libre por vertical. */
  roles?: string[];
  /** Cadencia declarada para este contacto (puede vivir también a nivel app). */
  modeloNegocio?: BusinessModel;
}
