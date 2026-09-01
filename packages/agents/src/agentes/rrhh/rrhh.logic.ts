// ─── RRHH: lógica pura (sin DB) ──────────────────────────────────────────────
// Detecta hitos de personal que requieren acción: fin del período de prueba
// (confirmar o desvincular) y revisiones de desempeño (vencidas o próximas).
// Determinístico, por proximidad de fechas. No evalúa personas, solo agenda hitos.

export type SeveridadRrhh = "critica" | "importante" | "oportunidad";
export type TipoHitoRrhh = "fin_periodo_prueba" | "revision_desempeno";

export interface UmbralesRrhh {
  /** Días de anticipación para marcar un hito como próximo. */
  diasProximo: number;
  /** Días de anticipación para empezar a avisar. */
  diasAviso: number;
}

export const UMBRALES_RRHH_DEFAULT: UmbralesRrhh = { diasProximo: 15, diasAviso: 30 };

export interface EmpleadoInput {
  id: string;
  nombre: string;
  estado: string | null;
  finPeriodoPrueba: string | null;
  proximaRevision: string | null;
}

export interface AlertaRrhh {
  empleadoId: string;
  nombre: string;
  tipo: TipoHitoRrhh;
  severidad: SeveridadRrhh;
  diasHasta: number;
  motivo: string;
}

/** Días hasta una fecha ISO respecto de `hoy` (negativo si ya pasó). */
export function diasHasta(fecha: string, hoy: Date): number {
  return Math.floor((new Date(fecha).getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

// Evalúa los hitos de un empleado. Ignora empleados dados de baja. Puede devolver
// 0, 1 o 2 alertas (prueba y/o revisión). Null-fechas se saltan.
export function evaluarEmpleado(
  e: EmpleadoInput, hoy: Date, u: UmbralesRrhh = UMBRALES_RRHH_DEFAULT,
): AlertaRrhh[] {
  if (e.estado === "baja") return [];
  const alertas: AlertaRrhh[] = [];

  if (e.finPeriodoPrueba != null) {
    const dias = diasHasta(e.finPeriodoPrueba, hoy);
    if (dias < 0) {
      alertas.push({ empleadoId: e.id, nombre: e.nombre, tipo: "fin_periodo_prueba", severidad: "critica", diasHasta: dias, motivo: `período de prueba vencido hace ${-dias} día(s) — confirmar o desvincular` });
    } else if (dias <= u.diasAviso) {
      alertas.push({ empleadoId: e.id, nombre: e.nombre, tipo: "fin_periodo_prueba", severidad: "importante", diasHasta: dias, motivo: `fin de período de prueba en ${dias} día(s)` });
    }
  }

  if (e.proximaRevision != null) {
    const dias = diasHasta(e.proximaRevision, hoy);
    if (dias < 0) {
      alertas.push({ empleadoId: e.id, nombre: e.nombre, tipo: "revision_desempeno", severidad: "importante", diasHasta: dias, motivo: `revisión de desempeño vencida hace ${-dias} día(s)` });
    } else if (dias <= u.diasProximo) {
      alertas.push({ empleadoId: e.id, nombre: e.nombre, tipo: "revision_desempeno", severidad: "oportunidad", diasHasta: dias, motivo: `revisión de desempeño en ${dias} día(s)` });
    }
  }

  return alertas;
}
