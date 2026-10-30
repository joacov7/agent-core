// ─── Guardia de incidentes: lógica pura (sin DB) ─────────────────────────────────────────────
// Vigila que lo grave NO quede sin atender. A diferencia del triage (que ordena por impacto), acá
// importa el TIEMPO: un pánico que nadie tomó en 5 minutos es crítico aunque afecte a un solo
// usuario. Determinístico y genérico: sirve para cualquier fuente de incidentes (alarmas, caídas
// de red, errores de software). No resuelve nada: solo avisa que se pasó el tiempo.

export type SeveridadGuardia = "critica" | "importante";
export type TipoGuardia = "sin_atender" | "atencion_lenta";

export interface UmbralesGuardia {
  /** Minutos que un incidente puede estar sin que nadie lo tome, por nivel. */
  sinAtenderMin: Record<string, number>;
  /** Minutos que puede estar "en atención" sin resolverse, por nivel. */
  atencionLentaMin: Record<string, number>;
  /** Umbral para un nivel desconocido. */
  defecto: { sinAtenderMin: number; atencionLentaMin: number };
}

export const UMBRALES_GUARDIA_DEFAULT: UmbralesGuardia = {
  sinAtenderMin: { fatal: 5, error: 30, warning: 240 },
  atencionLentaMin: { fatal: 30, error: 120, warning: 1440 },
  defecto: { sinAtenderMin: 60, atencionLentaMin: 240 },
};

export interface IncidenteGuardia {
  id: string;
  firma: string;
  titulo: string;
  nivel?: string | null;
  estado?: string | null;
  primeraVez?: string | null;
}

export interface AlertaGuardia {
  tipo: TipoGuardia;
  severidad: SeveridadGuardia;
  minutos: number;
  texto: string;
}

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

/** Estados que significan "nadie lo tomó todavía". Sin estado, se asume abierto. */
const SIN_ATENDER = new Set(["", "nuevo", "new", "abierto", "open"]);
const EN_ATENCION = new Set(["reconocido", "acknowledged", "en_atencion", "en atención", "in_progress"]);

/** "7 min", "2 h 5 min", "3 d". */
export function formatearDuracion(min: number): string {
  const m = Math.max(0, Math.floor(min));
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
  return `${Math.floor(m / 1440)} d`;
}

/** Null si no hay nada que avisar (resuelto/ignorado, todavía dentro de plazo, o sin fecha de inicio). */
export function evaluarGuardia(
  inc: IncidenteGuardia, ahora: Date, u: UmbralesGuardia = UMBRALES_GUARDIA_DEFAULT,
): AlertaGuardia | null {
  if (!inc.primeraVez) return null; // sin desde cuándo, no se puede medir
  const desde = Date.parse(inc.primeraVez);
  if (Number.isNaN(desde)) return null;
  const minutos = Math.max(0, Math.floor((ahora.getTime() - desde) / 60_000));
  const nivel = norm(inc.nivel);
  const estado = norm(inc.estado);

  if (SIN_ATENDER.has(estado)) {
    const limite = u.sinAtenderMin[nivel] ?? u.defecto.sinAtenderMin;
    if (minutos < limite) return null;
    return {
      tipo: "sin_atender", minutos,
      severidad: nivel === "warning" ? "importante" : "critica", // lo grave sin atender es crítico
      texto: `sin atender hace ${formatearDuracion(minutos)}`,
    };
  }
  if (EN_ATENCION.has(estado)) {
    const limite = u.atencionLentaMin[nivel] ?? u.defecto.atencionLentaMin;
    if (minutos < limite) return null;
    return { tipo: "atencion_lenta", minutos, severidad: "importante", texto: `en atención hace ${formatearDuracion(minutos)}, sin resolver` };
  }
  return null; // resuelto, falsa alarma, ignorado…
}
