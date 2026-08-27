/**
 * Capacidades opcionales que una app puede exponer. El Core deriva qué capacidades
 * hay disponibles a partir de qué providers están presentes (auto-descubrible):
 * ver `ProviderRegistry`. Un agente se activa si la app cubre `requiereCapacidades`.
 *
 * `contacts` es la única casi-universal (Contacto/Interacción son núcleo de Capa 1);
 * el resto degrada entidades de Capa 2 a capacidad para no hornear supuestos de rubro.
 */
export type CapabilityId =
  | "contacts"      // base de contactos + historial de interacciones
  | "transactions"  // compromisos económicos (con cadencia)
  | "receivables"   // cuentas por cobrar
  | "catalog"       // oferta y (opc.) costos
  | "inventory"     // existencias
  | "agenda"        // eventos, turnos, vencimientos
  | "pipeline"      // oportunidades / leads
  | "documents"     // artefactos con contenido
  | "competition"   // precios / datos de mercado externos
  | "suppliers"     // proveedores y compras
  | "production"    // procesos productivos
  | "logistics"     // envíos / entregas
  | "external-sources"; // prospectos / señales de fuentes externas (directorios, referidos, web)
