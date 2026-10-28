// Tokens y etiquetas compartidas por las pantallas (sin dependencias de React).

export const C = {
  bg: "#0e1315", surface: "#161d20", surface2: "#1b2327", line: "#2a343a",
  ink: "#e7ecee", soft: "#a3b0b6", faint: "#6c7c83", accent: "#2bb8ab", accentInk: "#7fd8ce",
  warn: "#d69a3a", crit: "#e0685a",
};

export type EstadoAgente = "no_disponible" | "apagado" | "en_espera" | "con_novedades" | "esperando_aprobacion";

export const ESTADO: Record<EstadoAgente, { label: string; color: string }> = {
  no_disponible: { label: "no disponible", color: C.faint },
  apagado: { label: "descansando", color: C.faint },
  en_espera: { label: "al día", color: C.accent },
  con_novedades: { label: "con novedades", color: C.warn },
  esperando_aprobacion: { label: "espera tu OK", color: C.crit },
};

export const CAT_LABEL: Record<string, string> = {
  direccion: "Dirección", clientes: "Clientes", comercial: "Comercial", finanzas: "Finanzas",
  operaciones: "Operaciones", comunicacion: "Comunicación", organizacion: "Organización",
};
export const CAT_ORDEN = ["direccion", "clientes", "comercial", "finanzas", "operaciones", "comunicacion", "organizacion"];

/** Un color por área: el avatar se reconoce a la distancia sin necesitar ilustraciones. */
export const CAT_COLOR: Record<string, string> = {
  direccion: "#7a8cff", clientes: "#2bb8ab", comercial: "#e08a4c", finanzas: "#d6b23a",
  operaciones: "#5fae6b", comunicacion: "#c773c9", organizacion: "#6fa8d6",
};

/** Forma mínima que las pantallas necesitan de un agente (lo que devuelve GET /api/agents). */
export interface PersonaVista { nombre: string; rol: string; saludo: string; personalizado: boolean }
