import { readFileSync } from "node:fs";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CoreStoreEnMemoria } from "@agent-core/app-ejemplo";

/**
 * Persistencia a archivo del CoreStore en memoria: lo que el usuario configura (agentes encendidos,
 * alias, autonomía), la bandeja (recomendaciones y su historial), la memoria de rechazos y el gasto
 * de IA sobreviven a un reinicio. Es un decorador: el store sigue siendo el mismo, solo se entera de
 * cada escritura y vuelca un snapshot (atómico, debounced, permisos 600).
 *
 * Alcance: una sola instancia de la app escribiendo el archivo (la del servidor de un negocio chico).
 * Para varias instancias o volumen real, usar `@agent-core/store-prisma` en vez de esto.
 */

const VERSION = 1;
const ESTADOS_TERMINALES = new Set(["executed", "rejected", "expired", "cancelled", "failed"]);
const DIA_MS = 86_400_000;

type Fila = { tenantId: string; id?: string; creadoEn?: string; actualizadoEn?: string; estado?: string };
interface Snapshot {
  version: number;
  recos: unknown[]; results: unknown[]; impacts: unknown[]; mem: unknown[]; gasto: unknown[]; agentCfgs: unknown[];
}

export interface OpcionesPersistencia {
  ruta: string;
  /** Espera tras la última escritura antes de volcar (junta ráfagas). Default 500 ms. */
  retardoMs?: number;
  /** Las recomendaciones terminales (ejecutadas, rechazadas, vencidas…) más viejas que esto se descartan. Default 90. */
  retencionDias?: number;
  ahora?: () => Date;
  log?: (msg: string) => void;
}

export interface Persistencia {
  /** Vuelca ya (y espera a que termine). Úsalo al apagar y en los tests. */
  guardar(): Promise<void>;
  /** Lo que se cargó del archivo al arrancar (para el log de inicio). */
  readonly cargadas: { recomendaciones: number; agentes: number; descartadas: number };
}

const esFila = (x: unknown): x is Fila =>
  !!x && typeof x === "object" && typeof (x as Fila).tenantId === "string" && (x as Fila).tenantId.length > 0;

/** Solo filas con forma de fila: un archivo editado a mano o a medias no puede meter basura en el store. */
const filas = (v: unknown): Fila[] => (Array.isArray(v) ? v.filter(esFila) : []);

function leer(ruta: string, log: (m: string) => void): Snapshot | undefined {
  let texto: string;
  try { texto = readFileSync(ruta, "utf8"); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") log(`[store] no pude leer ${ruta}: arranco vacío.`);
    return undefined;
  }
  try {
    const j = JSON.parse(texto) as Partial<Snapshot>;
    if (!j || typeof j !== "object" || j.version !== VERSION) {
      log(`[store] ${ruta} tiene un formato desconocido: lo ignoro (no lo piso hasta la próxima escritura).`);
      return undefined;
    }
    return j as Snapshot;
  } catch {
    log(`[store] ${ruta} está dañado (JSON inválido): arranco vacío.`);
    return undefined;
  }
}

export function persistirStore(store: CoreStoreEnMemoria, opts: OpcionesPersistencia): Persistencia {
  const { ruta, retardoMs = 500, retencionDias = 90, ahora = () => new Date(), log = (m) => console.warn(m) } = opts;

  // ── Carga (síncrona: el store tiene que estar completo antes del primer request) ──────────────
  const j = leer(ruta, log);
  let descartadas = 0;
  if (j) {
    const limite = ahora().getTime() - retencionDias * DIA_MS;
    const vigente = (r: Fila) => {
      if (!r.estado || !ESTADOS_TERMINALES.has(r.estado)) return true;
      const t = Date.parse(r.actualizadoEn ?? r.creadoEn ?? "");
      return Number.isNaN(t) || t >= limite; // sin fecha legible: se conserva (mejor de más que perder historial)
    };
    const recos = filas(j.recos).filter((r) => r.id && (vigente(r) || (descartadas++, false)));
    store._recos.push(...(recos as never[]));
    store._results.push(...(filas(j.results) as never[]));
    store._impacts.push(...(filas(j.impacts) as never[]));
    store._mem.push(...(filas(j.mem) as never[]));
    store._gasto.push(...(filas(j.gasto) as never[]));
    store._agentCfgs.push(...(filas(j.agentCfgs).filter((c) => typeof (c as { agentId?: unknown }).agentId === "string") as never[]));
  }

  // ── Escritura: atómica (tmp + rename), serializada y debounced ────────────────────────────────
  let timer: ReturnType<typeof setTimeout> | undefined;
  let enCurso: Promise<void> = Promise.resolve();
  let sucio = false;

  const volcar = async () => {
    if (!sucio) return;
    sucio = false;
    const snap: Snapshot = {
      version: VERSION,
      recos: store._recos, results: store._results, impacts: store._impacts,
      mem: store._mem, gasto: store._gasto, agentCfgs: store._agentCfgs,
    };
    const dir = dirname(ruta);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const tmp = `${ruta}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(snap), { encoding: "utf8", mode: 0o600 });
    await chmod(tmp, 0o600); // el mode de writeFile no aplica si el tmp ya existía
    await rename(tmp, ruta);
  };

  const encolar = () => {
    enCurso = enCurso.then(volcar).catch((e) => {
      sucio = true; // se reintenta con la próxima escritura
      log(`[store] no pude guardar ${ruta}: ${e instanceof Error ? e.message : String(e)}`);
    });
    return enCurso;
  };

  const programar = () => {
    sucio = true;
    if (timer) return;
    timer = setTimeout(() => { timer = undefined; void encolar(); }, retardoMs);
    timer.unref?.(); // no impide que el proceso termine. Un corte duro pierde, como mucho, los últimos `retardoMs` de cambios
  };

  const guardar = async () => {
    if (timer) { clearTimeout(timer); timer = undefined; }
    sucio = true;
    await encolar();
  };

  // ── Enganche: cada escritura del store avisa. Se envuelve el método, no se cambia el contrato ────
  const envolver = <T extends object, K extends keyof T>(obj: T, metodo: K) => {
    const original = obj[metodo] as unknown as (...a: unknown[]) => Promise<unknown>;
    (obj as Record<K, unknown>)[metodo] = async (...a: unknown[]) => {
      const r = await original.apply(obj, a);
      programar();
      return r;
    };
  };
  envolver(store.recommendations, "save");
  envolver(store.actionResults, "save");
  envolver(store.impacts, "save");
  envolver(store.memory, "put");
  envolver(store.gastoIA, "registrar");
  envolver(store.agentConfig, "set");

  // Una poda se registra en disco para no releer lo descartado.
  if (descartadas > 0) programar();

  return {
    guardar,
    cargadas: { recomendaciones: store._recos.length, agentes: store._agentCfgs.length, descartadas },
  };
}

/** Lee `STORE_PERSISTENTE`/`STORE_ARCHIVO`: persistente por defecto, apagable con `STORE_PERSISTENTE=off`. */
export function rutaDeStore(env: Record<string, string | undefined>): string | undefined {
  const v = (env.STORE_PERSISTENTE ?? "").trim().toLowerCase();
  if (["off", "0", "false", "no"].includes(v)) return undefined;
  return env.STORE_ARCHIVO?.trim() || ".agentcore/store.json";
}
