/**
 * Modelo de cadencia (modelo de negocio). El Contacto —o la app— declara su modelo
 * en vez de forzar una "Transacción" universal (que asumiría compra repetida).
 *
 * Los agentes de CRM/Postventa/Oportunidades declaran en su manifest qué modelos
 * soportan (`modelosNegocio`) y se activan o cambian de fórmula según la cadencia.
 */
export type BusinessModel =
  | "transaccional_repetitivo" // retail, gastronomía, estética
  | "proyecto"                 // constructora, legal por caso, software
  | "suscripcion"              // monitoreo, abonos
  | "servicio_recurrente";     // contable mensual, mantenimiento
