import type { AutonomyMode } from "./autonomy.js";
import type { CapabilityId } from "./capabilities.js";
import type { BusinessModel } from "./canonical/cadencia.js";
import type { JsonSchema } from "./common.js";

export type CategoriaAgente =
  | "direccion" | "finanzas" | "clientes" | "comercial"
  | "comunicacion" | "organizacion" | "operaciones";

export type NivelIA = "ninguno" | "redacta" | "clasifica" | "razona";
export type CostoEstimado = "cero" | "bajo" | "medio" | "alto";
export type FrecuenciaRecomendada = "evento" | "diaria" | "semanal" | "manual";
export type RiesgoAgente = "bajo" | "medio" | "alto";

/**
 * El agente se describe a sí mismo. El sistema decide compatibilidad y activación
 * desde el manifest, no desde código.
 *
 * Regla de activación:
 *   capacidadesDeLaApp ⊇ requiereCapacidades
 *   Y (si define modelosNegocio) el modelo de la app está incluido.
 * Recién ahí el agente aparece disponible; el usuario lo enciende, elige autonomía
 * (`<= autonomiaMaxima`) y ajusta `configSchema`.
 */
export interface AgentManifest {
  id: string;
  version: string; // semver
  nombre: string;
  descripcion: string;
  categoria: CategoriaAgente;

  requiereCapacidades: CapabilityId[];
  requiereTools: string[];
  /** Si se define, restringe el agente a estos modelos de negocio (cadencia). */
  modelosNegocio?: BusinessModel[];

  nivelIA: NivelIA;
  costoEstimado: CostoEstimado;
  frecuenciaRecomendada: FrecuenciaRecomendada;

  emiteAcciones: boolean;
  toolsDeEscritura: string[];
  riesgo: RiesgoAgente;
  autonomiaMaxima: AutonomyMode;

  /** Schema de configuración específico del agente (ajustable por tenant). */
  configSchema?: JsonSchema;
}
