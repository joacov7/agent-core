import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { estadoVacio, type EstadoProgramador } from "./programador";

/** Lee el estado del programador. Si no existe o está roto, arranca vacío (nunca tumba la app). */
export async function cargarEstado(ruta: string): Promise<EstadoProgramador> {
  try {
    const j = JSON.parse(await readFile(ruta, "utf8")) as Partial<EstadoProgramador>;
    return {
      ...estadoVacio(),
      ...(typeof j.ultimoResumen === "string" ? { ultimoResumen: j.ultimoResumen } : {}),
      ...(typeof j.ultimaCorridaAlertas === "number" ? { ultimaCorridaAlertas: j.ultimaCorridaAlertas } : {}),
      avisados: j.avisados && typeof j.avisados === "object" ? (j.avisados as Record<string, string>) : {},
      avisosDia: j.avisosDia && typeof j.avisosDia.n === "number" ? j.avisosDia : { fecha: "", n: 0 },
    };
  } catch {
    return estadoVacio();
  }
}

/**
 * Guarda de forma atómica (archivo temporal + rename): un corte a mitad de escritura no deja un
 * JSON a medias. Persistir esto evita reenviar el resumen o repetir alertas al reiniciar la app.
 */
export async function guardarEstado(ruta: string, estado: EstadoProgramador): Promise<void> {
  await mkdir(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(estado), { encoding: "utf8", mode: 0o600 });
  await rename(tmp, ruta);
}
