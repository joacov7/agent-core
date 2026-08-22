// Un provider por capacidad (no una interfaz monolítica). La app implementa solo
// los que tiene; el Core deriva las capacidades disponibles de cuáles existen
// (ver ProviderRegistry). CADA método recibe TenantCtx y filtra por tenant.

import type { ID } from "../common.js";
import type { TenantCtx } from "../tenant.js";
import type { ListQuery, Page } from "./query.js";

import type { Contacto } from "../canonical/contacto.js";
import type { Interaccion } from "../canonical/interaccion.js";
import type { Tarea } from "../canonical/tarea.js";
import type {
  Transaccion, Cobro, Oportunidad, Evento, Documento,
  CatalogoItem, Existencia, EvidenciaMercado, Compra,
} from "../canonical/opcionales.js";

/* ── contacts ─────────────────────────────────────────────────────────────── */
/** Capacidad `contacts`: base de contactos + historial. */
export interface ContactsProvider {
  list(ctx: TenantCtx, query?: ListQuery): Promise<Page<Contacto>>;
  get(ctx: TenantCtx, id: ID): Promise<Contacto | null>;
  history(ctx: TenantCtx, contactoId: ID, query?: ListQuery): Promise<Page<Interaccion>>;
}

/* ── interactions (parte de `contacts`) ───────────────────────────────────── */
/** Interacciones entrantes/salientes; las pendientes alimentan a Atención/WhatsApp. */
export interface InteractionsProvider {
  pending(ctx: TenantCtx, query?: ListQuery): Promise<Page<Interaccion>>;
  byContact(ctx: TenantCtx, contactoId: ID, query?: ListQuery): Promise<Page<Interaccion>>;
}

/* ── transactions ─────────────────────────────────────────────────────────── */
export interface TransactionsProvider {
  byContact(ctx: TenantCtx, contactoId: ID, query?: ListQuery): Promise<Page<Transaccion>>;
  recent(ctx: TenantCtx, query?: ListQuery): Promise<Page<Transaccion>>;
}

/* ── receivables ──────────────────────────────────────────────────────────── */
export interface ReceivablesProvider {
  pending(ctx: TenantCtx, query?: ListQuery): Promise<Page<Cobro>>;
  overdue(ctx: TenantCtx, query?: ListQuery): Promise<Page<Cobro>>;
}

/* ── catalog ──────────────────────────────────────────────────────────────── */
export interface CatalogProvider {
  items(ctx: TenantCtx, query?: ListQuery): Promise<Page<CatalogoItem>>;
  get(ctx: TenantCtx, id: ID): Promise<CatalogoItem | null>;
}

/* ── inventory ────────────────────────────────────────────────────────────── */
export interface InventoryProvider {
  stock(ctx: TenantCtx, query?: ListQuery): Promise<Page<Existencia>>;
  lowStock(ctx: TenantCtx, query?: ListQuery): Promise<Page<Existencia>>;
}

/* ── agenda ───────────────────────────────────────────────────────────────── */
export interface AgendaProvider {
  upcoming(ctx: TenantCtx, query?: ListQuery): Promise<Page<Evento>>;
}

/* ── pipeline ─────────────────────────────────────────────────────────────── */
export interface PipelineProvider {
  open(ctx: TenantCtx, query?: ListQuery): Promise<Page<Oportunidad>>;
  byContact(ctx: TenantCtx, contactoId: ID, query?: ListQuery): Promise<Page<Oportunidad>>;
}

/* ── documents ────────────────────────────────────────────────────────────── */
export interface DocumentsProvider {
  list(ctx: TenantCtx, query?: ListQuery): Promise<Page<Documento>>;
  get(ctx: TenantCtx, id: ID): Promise<Documento | null>;
}

/* ── competition ──────────────────────────────────────────────────────────── */
export interface CompetitionProvider {
  marketEvidence(ctx: TenantCtx, query?: ListQuery): Promise<Page<EvidenciaMercado>>;
}

/* ── suppliers ────────────────────────────────────────────────────────────── */
export interface SuppliersProvider {
  list(ctx: TenantCtx, query?: ListQuery): Promise<Page<Contacto>>;
  purchases(ctx: TenantCtx, query?: ListQuery): Promise<Page<Compra>>;
}

/* ── production ───────────────────────────────────────────────────────────── */
/** Procesos/actividades productivas modelados como Tarea. */
export interface ProductionProvider {
  processes(ctx: TenantCtx, query?: ListQuery): Promise<Page<Tarea>>;
}

/* ── logistics ────────────────────────────────────────────────────────────── */
/** Entregas/envíos modelados como Tarea (+ Evento vía agenda). */
export interface LogisticsProvider {
  deliveries(ctx: TenantCtx, query?: ListQuery): Promise<Page<Tarea>>;
}
