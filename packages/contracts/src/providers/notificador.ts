import type { TenantCtx } from "../tenant.js";

/** Mensaje saliente hacia una persona (resumen, alerta). Texto plano: el canal decide el formato. */
export interface MensajeNotificacion {
  texto: string;
}

/**
 * Puerto de SALIDA: cómo el sistema avisa a una persona (Telegram, email, push…). Solo envía:
 * no recibe ni ejecuta nada. Recibe SIEMPRE `TenantCtx`. Los fallos se lanzan como error: quien
 * llama decide si reintenta (el motor nunca asume que un aviso llegó).
 */
export interface Notificador {
  enviar(ctx: TenantCtx, mensaje: MensajeNotificacion): Promise<void>;
}
