import type { JsonSchema } from "@agent-core/contracts";

/**
 * Ajustes de un agente que el tenant puede cambiar (umbrales numéricos). Una sola definición genera
 * DOS cosas, para que no se desalineen: el `configSchema` del manifest (lo que la consola dibuja y
 * valida) y la lectura de la config en tiempo de corrida (que nunca confía en lo guardado: un valor
 * inválido o fuera de rango cae al default, nunca rompe al agente).
 */
export interface CampoAjuste {
  titulo: string;
  descripcion: string;
  default: number;
  min: number;
  max: number;
  /** Por defecto `true`. Con `false` admite decimales. */
  entero?: boolean;
  /** "días", "minutos", "x", … solo para mostrar. */
  unidad?: string;
}
export type CamposAjuste<K extends string = string> = Record<K, CampoAjuste>;

export function schemaDeCampos(campos: CamposAjuste): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(
      Object.entries(campos).map(([clave, c]) => [clave, {
        type: c.entero === false ? "number" : "integer",
        title: c.titulo,
        description: c.descripcion,
        default: c.default,
        minimum: c.min,
        maximum: c.max,
        ...(c.unidad ? { "x-unidad": c.unidad } : {}),
      }]),
    ),
  };
}

/** Valores efectivos: lo configurado si es un número válido y está en rango; si no, el default del campo. */
export function leerCampos<K extends string>(
  campos: CamposAjuste<K>, config?: Record<string, unknown>, base?: Partial<Record<K, number>>,
): Record<K, number> {
  const salida = {} as Record<K, number>;
  for (const clave of Object.keys(campos) as K[]) {
    const c = campos[clave];
    const valido = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= c.min && v <= c.max;
    const crudo = [config?.[clave], base?.[clave]].find(valido);
    salida[clave] = crudo === undefined ? c.default : c.entero === false ? crudo : Math.floor(crudo);
  }
  return salida;
}
