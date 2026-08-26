// ─── Activación de agentes por manifest (sin DB) ─────────────────────────────
// Regla (sección 5 del documento): un agente está disponible si
//   capacidadesDeLaApp ⊇ manifest.requiereCapacidades
//   Y (si el manifest define modelosNegocio) el modelo de la app está incluido.
// Recién ahí el usuario lo enciende, elige autonomía (<= autonomiaMaxima) y
// ajusta su configSchema. La decisión es 100% determinística.

import type { AgentManifest, BusinessModel, CapabilityId } from "@agent-core/contracts";

/** Lo que la app declara/aporta, contra lo que se evalúa cada manifest. */
export interface CapacidadesApp {
  capacidades: CapabilityId[];
  /** Modelo de negocio (cadencia) de la app; requerido si algún manifest lo exige. */
  modeloNegocio?: BusinessModel;
}

/** ¿La app cubre las capacidades requeridas por el manifest? */
export function cubreCapacidades(manifest: AgentManifest, app: CapacidadesApp): boolean {
  const disponibles = new Set(app.capacidades);
  return manifest.requiereCapacidades.every((c) => disponibles.has(c));
}

/** ¿El modelo de negocio de la app es compatible con el manifest? */
export function cumpleModeloNegocio(manifest: AgentManifest, app: CapacidadesApp): boolean {
  const modelos = manifest.modelosNegocio;
  if (!modelos || modelos.length === 0) return true; // sin restricción → cualquier cadencia
  if (!app.modeloNegocio) return false;              // el manifest exige cadencia y la app no la declara
  return modelos.includes(app.modeloNegocio);
}

/** ¿El agente está activable en esta app? (capacidades + modelo de negocio). */
export function esActivable(manifest: AgentManifest, app: CapacidadesApp): boolean {
  return cubreCapacidades(manifest, app) && cumpleModeloNegocio(manifest, app);
}

/** Filtra un catálogo de manifests a los activables en la app. */
export function manifestsActivables<T extends { manifest: AgentManifest }>(
  agentes: T[], app: CapacidadesApp,
): T[] {
  return agentes.filter((a) => esActivable(a.manifest, app));
}
