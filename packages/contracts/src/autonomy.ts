/**
 * Nivel de autonomía con el que un agente (o una tool) puede operar.
 *
 * Valores en inglés a propósito: es el vocabulario que ya usan las políticas y el
 * enforcement de Regionales (`src/lib/agents/types.ts`), que migran al Core casi
 * tal cual. El usuario elige la autonomía efectiva de un agente encendido,
 * siempre `<= manifest.autonomiaMaxima`.
 *
 *   manual     → solo propone; nunca ejecuta por sí mismo.
 *   assisted   → ejecuta previa aprobación humana.
 *   autonomous → ejecuta sin aprobación (dentro de sus políticas).
 */
export type AutonomyMode = "manual" | "assisted" | "autonomous";
