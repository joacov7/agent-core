import type { ListQuery, Page } from "@agent-core/contracts";

/**
 * Lo mínimo que el adapter necesita de un driver SQL. `pg.Pool` lo cumple tal cual, así este
 * paquete no depende de ningún driver (igual que store-prisma con `PrismaLike`).
 */
export type FilaDB = Record<string, unknown>;
export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: FilaDB[] }>;
}

/** Opciones de conexión que vuelven la SESIÓN de solo lectura aunque el rol tuviera permisos de escritura. */
export const OPCIONES_SOLO_LECTURA = "-c default_transaction_read_only=on -c statement_timeout=15000";

const ESCRITURA = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do)\b/i;

/**
 * Defensa en profundidad: rechaza todo lo que no sea un SELECT. La protección real es el rol
 * de Postgres de solo lectura (`sql/solo-lectura.sql`); esto evita que un cambio futuro del
 * adapter escriba por accidente.
 */
export function soloLectura(db: Queryable): Queryable {
  return {
    query(sql, params) {
      if (!/^\s*(select|with)\b/i.test(sql) || ESCRITURA.test(sql)) {
        return Promise.reject(new Error("El adapter del WISP es de solo lectura: solo se permiten SELECT."));
      }
      return db.query(sql, params);
    },
  };
}

/**
 * Los agentes leen `items` y no siguen `nextCursor`, así que el tope por página es alto: un
 * WISP con miles de abonados no se trunca en silencio. Con `limit` explícito se pagina.
 */
export const LIMITE_MAXIMO = 10_000;

export interface Ventana { limit: number; offset: number }

export function ventana(q?: ListQuery): Ventana {
  const pedido = q?.limit !== undefined && Number.isFinite(q.limit) ? Math.floor(q.limit) : LIMITE_MAXIMO;
  const limit = Math.min(Math.max(pedido, 1), LIMITE_MAXIMO);
  const offset = q?.cursor && /^\d+$/.test(q.cursor) ? Number(q.cursor) : 0;
  return { limit, offset };
}

/** Recibe las filas pedidas con `limit + 1` y arma la página (con cursor si quedaron más). */
export function pagina<T>(filas: T[], v: Ventana): Page<T> {
  const hayMas = filas.length > v.limit;
  const items = hayMas ? filas.slice(0, v.limit) : filas;
  return hayMas ? { items, nextCursor: String(v.offset + v.limit) } : { items };
}
