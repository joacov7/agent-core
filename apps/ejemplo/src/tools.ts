import type { WriteToolHandler } from "@agent-core/contracts";

/** Bandeja de salida en memoria: registra lo que "se envió/creó". */
export interface Outbox {
  whatsapp: { to: string; texto: string }[];
  tareas: { titulo: string }[];
}

export function crearTools(outbox: Outbox): Record<string, WriteToolHandler> {
  return {
    enviar_whatsapp: {
      definicion: { id: "enviar_whatsapp", tipo: "escritura", descripcion: "Envía un WhatsApp a un contacto." },
      async ejecutar(_ctx, params) {
        const p = params as { to?: string; texto?: string };
        outbox.whatsapp.push({ to: String(p.to ?? ""), texto: String(p.texto ?? "") });
        return { enviado: true };
      },
    },
    crear_tarea: {
      definicion: { id: "crear_tarea", tipo: "escritura", descripcion: "Crea una tarea de seguimiento." },
      async ejecutar(_ctx, params) {
        const p = params as { titulo?: string };
        outbox.tareas.push({ titulo: String(p.titulo ?? "") });
        return { creada: true };
      },
    },
  };
}
