import type { CanonicalEntity, EntityRef, ID, ISODateTime } from "../common.js";
import type { BusinessModel } from "./cadencia.js";

/**
 * Capa 2 — entidades OPCIONALES, expuestas vía capacidades (no son núcleo).
 * Cada una degrada un supuesto de rubro a algo activable por app. Ver el análisis
 * de riesgo en la sección 2 del documento de arquitectura.
 */

/**
 * Compromiso económico modelado como *engagement* con subtipo de cadencia
 * (no como "orden" de e-commerce). Capacidad: `transactions`.
 */
export interface Transaccion extends CanonicalEntity {
  contactoId: ID;
  cadencia: BusinessModel;
  estado: string;
  titulo?: string;
  monto?: number;
  moneda?: string;
  abiertaEn?: ISODateTime;
  cerradaEn?: ISODateTime;
}

/** Componente de una transacción (producto, servicio, hora, m²). Capacidad: `catalog`. */
export interface LineaItem extends CanonicalEntity {
  transaccionId?: ID;
  catalogoItemId?: ID;
  descripcion: string;
  cantidad?: number;
  precioUnitario?: number;
}

export type EstadoCobro = "pendiente" | "parcial" | "cobrado" | "vencido" | "incobrable";

/** Derecho de cobro (factura, honorario, cuota, certificado). Capacidad: `receivables`. */
export interface Cobro extends CanonicalEntity {
  contactoId: ID;
  estado: EstadoCobro;
  monto: number;
  moneda?: string;
  venceEn?: ISODateTime;
  transaccionId?: ID;
}

/** Posible negocio futuro (lead, presupuesto, licitación). Capacidad: `pipeline`. */
export interface Oportunidad extends CanonicalEntity {
  contactoId?: ID;
  etapa: string;
  titulo: string;
  valorEstimado?: number;
  probabilidad?: number; // 0..1
  cierreEstimado?: ISODateTime;
}

/** Punto en el tiempo (turno, audiencia, vencimiento). Capacidad: `agenda`. */
export interface Evento extends CanonicalEntity {
  tipo: string;
  titulo: string;
  inicia: ISODateTime;
  termina?: ISODateTime;
  refEntidad?: EntityRef;
}

/** Archivo/artefacto con contenido (escrito, contrato, certificado). Capacidad: `documents`. */
export interface Documento extends CanonicalEntity {
  tipo: string;
  titulo: string;
  url?: string;
  refEntidad?: EntityRef;
}

/** Ítem de catálogo / oferta (producto, servicio, arancel). Costo OPCIONAL. Capacidad: `catalog`. */
export interface CatalogoItem extends CanonicalEntity {
  nombre: string;
  sku?: string;
  precio?: number;
  /** COGS u horas/tarifa según vertical; un honorario fijo puede no tener costo de ítem. */
  costo?: number;
  moneda?: string;
  activo?: boolean;
}

/** Existencias de un ítem. Capacidad: `inventory`. */
export interface Existencia extends CanonicalEntity {
  catalogoItemId: ID;
  cantidad: number;
  minimo?: number;
  ubicacion?: string;
}

/** Evidencia de mercado externa (precio de competidor, dato público). Capacidad: `competition`. */
export interface EvidenciaMercado extends CanonicalEntity {
  fuente: string;
  refEntidad?: EntityRef;
  precio?: number;
  moneda?: string;
  observadoEn: ISODateTime;
}

/** Compra a proveedor. Capacidad: `suppliers`. */
export interface Compra extends CanonicalEntity {
  proveedorId: ID;
  estado: string;
  monto?: number;
  moneda?: string;
  fecha?: ISODateTime;
}

/**
 * Señal externa: prospecto/lead descubierto FUERA de la base (directorio, referido,
 * marketplace, web). Es un contacto *potencial*, todavía no un `Contacto`. La
 * capacidad `external-sources` la aporta; el agente Prospección la prioriza por
 * encaje y descarta las que ya existen en la base (dedup por `clave`).
 */
export interface SenalExterna extends CanonicalEntity {
  fuente: string;              // de dónde salió (directorio, referido, marketplace, web…)
  nombre: string;              // nombre del prospecto
  /** Identificador de deduplicación contra la base (email / teléfono / CUIT). */
  clave?: string;
  /** Señal de intención o motivo de encaje (texto libre de la fuente). */
  motivo?: string;
  /** Encaje declarado por la fuente, 0..100 (opcional). */
  score?: number;
  observadoEn: ISODateTime;
  refEntidad?: EntityRef;
}
