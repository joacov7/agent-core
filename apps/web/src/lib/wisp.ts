import pg from "pg";
import { OPCIONES_SOLO_LECTURA, type Queryable } from "@agent-core/app-wisp";

// Pool de lectura a la base de guaynet. Una sola instancia por proceso (en dev, HMR recarga
// módulos: se cuelga de globalThis para no abrir un pool nuevo en cada recarga).
const g = globalThis as unknown as { __wispPool?: pg.Pool };

export function poolWisp(connectionString: string): Queryable {
  if (!g.__wispPool) {
    const pool = new pg.Pool({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      // La sesión es de solo lectura aunque el usuario tuviera permiso de escribir.
      options: OPCIONES_SOLO_LECTURA,
    });
    // Un cliente ocioso que se cae emite 'error': sin handler tumbaría el proceso.
    pool.on("error", (e) => console.error("[wisp] error en el pool de Postgres:", e.message));
    g.__wispPool = pool;
  }
  return g.__wispPool;
}
