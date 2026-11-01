/**
 * Ajustes por agente: lee el `configSchema` del manifest (el subconjunto de JSON Schema que usan los
 * agentes: propiedades numéricas, booleanas o de texto con rango/lista) para dos cosas:
 *  - dibujar el formulario de la consola (`camposDeSchema`, `ajustesDe`), y
 *  - validar lo que llega por la API antes de guardarlo (`validarConfig`). Lo guardado nunca se
 *    "arregla" en silencio: si no es válido, se rechaza con un mensaje que dice qué campo y por qué.
 * Puro (sin Next ni store): se testea solo.
 */

export type TipoCampo = "integer" | "number" | "boolean" | "string";

export interface CampoVista {
  clave: string;
  tipo: TipoCampo;
  titulo: string;
  descripcion?: string;
  unidad?: string;
  min?: number;
  max?: number;
  opciones?: string[];
  maxLength?: number;
}

/** Lo que la consola necesita para mostrar y editar los ajustes de un agente. */
export interface AjustesVista {
  campos: CampoVista[];
  /** Valor vigente de cada campo (lo propio si lo hay y es válido; si no, el de la línea; si no, el del agente). */
  valores: Record<string, unknown>;
  /** A qué vuelve cada campo si se restaura: el de la línea o, en su defecto, el del agente. */
  porDefecto: Record<string, unknown>;
  /** Campos con un valor propio guardado. */
  personalizados: string[];
}

type Props = Record<string, Record<string, unknown>>;
const propsDe = (schema: Record<string, unknown> | undefined): Props => {
  const p = schema?.properties;
  return p && typeof p === "object" && !Array.isArray(p) ? (p as Props) : {};
};
const TIPOS: TipoCampo[] = ["integer", "number", "boolean", "string"];

export function camposDeSchema(schema: Record<string, unknown> | undefined): CampoVista[] {
  const campos: CampoVista[] = [];
  for (const [clave, p] of Object.entries(propsDe(schema))) {
    if (!p || !TIPOS.includes(p.type as TipoCampo)) continue; // un tipo que la consola no sabe dibujar se omite
    const c: CampoVista = { clave, tipo: p.type as TipoCampo, titulo: typeof p.title === "string" ? p.title : clave };
    if (typeof p.description === "string") c.descripcion = p.description;
    if (typeof p["x-unidad"] === "string") c.unidad = p["x-unidad"];
    if (typeof p.minimum === "number") c.min = p.minimum;
    if (typeof p.maximum === "number") c.max = p.maximum;
    if (typeof p.maxLength === "number") c.maxLength = p.maxLength;
    if (Array.isArray(p.enum)) c.opciones = p.enum.filter((x): x is string => typeof x === "string");
    campos.push(c);
  }
  return campos;
}

/** `null` si el valor es válido para el campo; si no, por qué no. */
function problema(c: CampoVista, v: unknown): string | null {
  switch (c.tipo) {
    case "integer":
    case "number": {
      if (typeof v !== "number" || !Number.isFinite(v)) return "tiene que ser un número";
      if (c.tipo === "integer" && !Number.isInteger(v)) return "tiene que ser un número entero";
      if (c.min !== undefined && v < c.min) return `no puede ser menor que ${c.min}`;
      if (c.max !== undefined && v > c.max) return `no puede ser mayor que ${c.max}`;
      return null;
    }
    case "boolean":
      return typeof v === "boolean" ? null : "tiene que ser sí o no";
    case "string":
      if (typeof v !== "string") return "tiene que ser texto";
      if (c.maxLength !== undefined && v.length > c.maxLength) return `no puede superar ${c.maxLength} caracteres`;
      if (c.opciones && !c.opciones.includes(v)) return `tiene que ser una de: ${c.opciones.join(", ")}`;
      return null;
  }
}

export type ResultadoValidacion = { ok: true; valor: Record<string, unknown> } | { ok: false; error: string };

/** Valida una config propuesta contra el schema del agente. Solo se aceptan claves del schema. */
export function validarConfig(schema: Record<string, unknown> | undefined, config: unknown, nombreAgente: string): ResultadoValidacion {
  if (config === null || typeof config !== "object" || Array.isArray(config)) return { ok: false, error: "Los ajustes tienen que ser un objeto." };
  const entradas = Object.entries(config as Record<string, unknown>);
  if (entradas.length === 0) return { ok: true, valor: {} };
  const campos = new Map(camposDeSchema(schema).map((c) => [c.clave, c]));
  if (campos.size === 0) return { ok: false, error: `${nombreAgente} no tiene ajustes configurables.` };
  const valor: Record<string, unknown> = {};
  for (const [clave, v] of entradas) {
    const c = campos.get(clave);
    if (!c) return { ok: false, error: `${nombreAgente} no tiene el ajuste "${clave}".` };
    const p = problema(c, v);
    if (p) return { ok: false, error: `"${c.titulo}" ${p}.` };
    valor[clave] = v;
  }
  return { ok: true, valor };
}

/**
 * Vista de ajustes de un agente. `propia` es la config guardada del tenant y `base` la de la línea
 * (p.ej. Seguridad avisa renovaciones a 30 días): lo propio válido gana, después la línea, después el
 * default del agente. Devuelve `undefined` si el agente no tiene ajustes.
 */
export function ajustesDe(
  schema: Record<string, unknown> | undefined, propia: Record<string, unknown> | undefined, base: Record<string, unknown> | undefined,
): AjustesVista | undefined {
  const campos = camposDeSchema(schema);
  if (campos.length === 0) return undefined;
  const props = propsDe(schema);
  const valores: Record<string, unknown> = {};
  const porDefecto: Record<string, unknown> = {};
  const personalizados: string[] = [];
  for (const c of campos) {
    const dflt = props[c.clave]!.default;
    const baseValida = base && c.clave in base && problema(c, base[c.clave]) === null;
    porDefecto[c.clave] = baseValida ? base![c.clave] : dflt;
    const propiaValida = propia && c.clave in propia && problema(c, propia[c.clave]) === null;
    if (propiaValida) personalizados.push(c.clave);
    valores[c.clave] = propiaValida ? propia![c.clave] : porDefecto[c.clave];
  }
  return { campos, valores, porDefecto, personalizados };
}
