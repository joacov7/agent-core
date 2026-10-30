import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { estadoVacio, type EstadoProgramador } from "./programador";

/** Estado persistido: uno por línea/tenant (cada línea avisa y recuerda lo suyo). */
export type EstadosProgramador = Record<string, EstadoProgramador>;

function sanear(j: Partial<EstadoProgramador> | undefined): EstadoProgramador {
  if (!j || typeof j !== "object") return estadoVacio();
  return {
    ...estadoVacio(),
    ...(typeof j.ultimoResumen === "string" ? { ultimoResumen: j.ultimoResumen } : {}),
    ...(typeof j.ultimaCorridaAlertas === "number" ? { ultimaCorridaAlertas: j.ultimaCorridaAlertas } : {}),
    avisados: j.avisados && typeof j.avisados === "object" ? (j.avisados as Record<string, string>) : {},
    avisosDia: j.avisosDia && typeof j.avisosDia.n === "number" ? j.avisosDia : { fecha: "", n: 0 },
  };
}

/**
 * Lee el estado de todas las líneas. Si no existe o está roto, arranca vacío (nunca tumba la app).
 * Acepta el formato anterior (un solo estado plano, de cuando había una sola línea): se asigna a
 * `tenantLegado` (la línea principal), así actualizar no reenvía el resumen de hoy.
 */
export async function cargarEstados(ruta: string, tenantLegado: string): Promise<EstadosProgramador> {
  try {
    const j = JSON.parse(await readFile(ruta, "utf8")) as { version?: number; tenants?: Record<string, Partial<EstadoProgramador>> } & Partial<EstadoProgramador>;
    if (j.version === 2 && j.tenants && typeof j.tenants === "object") {
      return Object.fromEntries(Object.entries(j.tenants).map(([t, e]) => [t, sanear(e)]));
    }
    if ("avisados" in j || "ultimoResumen" in j) return { [tenantLegado]: sanear(j) }; // formato plano anterior
    return {};
  } catch {
    return {};
  }
}

/**
 * Guarda de forma atómica (archivo temporal + rename): un corte a mitad de escritura no deja un
 * JSON a medias. Persistir esto evita reenviar el resumen o repetir alertas al reiniciar la app.
 */
export async function guardarEstados(ruta: string, estados: EstadosProgramador): Promise<void> {
  await mkdir(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ version: 2, tenants: estados }), { encoding: "utf8", mode: 0o600 });
  await rename(tmp, ruta);
}
