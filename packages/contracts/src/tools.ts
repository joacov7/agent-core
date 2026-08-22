import type { JsonSchema } from "./common.js";
import type { TenantCtx } from "./tenant.js";

/**
 * Tools: las de LECTURA delegan en providers (no tienen SQL); las de ESCRITURA
 * ejecutan acciones en el mundo (enviar mensaje, cambiar precio, crear tarea) y el
 * enforcement del Core las intercepta SIEMPRE, sean core o de dominio.
 */
export type TipoTool = "lectura" | "escritura";

/** Definición declarativa de una tool (core o de dominio). */
export interface ToolDefinition {
  id: string;
  tipo: TipoTool;
  descripcion: string;
  inputSchema?: JsonSchema;
}

/**
 * Handler de una tool de escritura, implementado por la app. Recibe SIEMPRE TenantCtx.
 * El Core no lo llama directo: pasa por el enforcement (políticas + autonomía) antes
 * de ejecutar.
 */
export interface WriteToolHandler<P = Record<string, unknown>, R = unknown> {
  definicion: ToolDefinition;
  ejecutar(ctx: TenantCtx, params: P): Promise<R>;
}
