import type { ID, ISODateTime } from "../common.js";

/**
 * Agregados canónicos: el adaptador los calcula (típicamente en SQL) y los agentes
 * los consumen sin conocer el dominio. Son la entrada de los agentes que necesitan
 * resúmenes (CRM, Venta cruzada, Rentabilidad), y se exponen como métodos
 * OPCIONALES de los providers: la app los implementa solo si puede darlos.
 */

/** Resumen transaccional de un contacto (entrada del CRM). Capacidad: `transactions`. */
export interface ResumenContacto {
  contactoId: ID;
  compras: number;
  totalGastado: number;
  ticketPromedio: number;
  ultimaTransaccion?: ISODateTime;
  diasDesdeUltima: number;
  /** Frecuencia habitual de compra en días (null si no hay historia suficiente). */
  frecuenciaDias?: number | null;
}

/** Par de ítems complementarios por co-ocurrencia en la canasta. Capacidad: `transactions` (+catalog para nombres). */
export interface ParComplementario {
  itemA: ID;
  itemB: ID;
  nombreA?: string | null;
  nombreB?: string | null;
  coOcurrencias: number;
}

/** Ítems que un contacto ya adquirió (para detectar el complementario que falta). */
export interface CanastaContacto {
  contactoId: ID;
  nombre?: string;
  itemIds: ID[];
}

/** Resumen de rentabilidad de un ítem (entrada del agente Rentabilidad). Capacidad: `catalog` (+transactions/inventory). */
export interface ResumenItem {
  catalogoItemId: ID;
  nombre: string;
  precio: number;
  costo?: number | null;
  margenPct?: number | null;
  ventas30d: number;
  stock: number;
  valorInmovilizado?: number | null;
}
