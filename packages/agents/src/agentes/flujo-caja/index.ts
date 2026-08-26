import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad, confianzaPorOrigen } from "@agent-core/core";
import { proyectarFlujo, type MovimientoFlujo, type RangoFlujo } from "./flujo-caja.logic.js";

export * from "./flujo-caja.logic.js";

/**
 * Flujo de caja. Proyecta ingresos (cobros por vencer) y egresos (compras) por
 * ventana temporal y alerta cuando el neto de corto plazo es negativo. `suppliers`
 * es opcional: sin él, proyecta solo ingresos.
 */
export const manifestFlujoCaja: AgentManifest = {
  id: "flujo_caja",
  version: "0.1.0",
  nombre: "Flujo de caja",
  descripcion: "Proyecta ingresos/egresos y alerta déficits de corto plazo.",
  categoria: "finanzas",
  requiereCapacidades: ["receivables"],
  requiereTools: ["consultar_cobros"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

// Solo el corto plazo dispara alerta; el largo plazo es informativo (resumen).
const SEVERIDAD_DEFICIT: Partial<Record<RangoFlujo, "critica" | "importante">> = {
  "0-7": "critica",
  "8-30": "importante",
};

export const agenteFlujoCaja: Agent = {
  manifest: manifestFlujoCaja,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    const receivables = providers.receivables;
    if (!receivables) return { recomendaciones: [] };

    const hoy = ctx.now?.() ?? new Date();
    const { items: cobros } = await receivables.pending(ctx);
    const ingresos: MovimientoFlujo[] = cobros.map((c) => ({
      monto: c.monto, ...(c.venceEn ? { fecha: c.venceEn } : {}),
    }));

    let egresos: MovimientoFlujo[] = [];
    if (providers.suppliers?.purchases) {
      const { items: compras } = await providers.suppliers.purchases(ctx);
      egresos = compras
        .filter((p) => p.monto != null)
        .map((p) => ({ monto: p.monto as number, ...(p.fecha ? { fecha: p.fecha } : {}) }));
    }

    const proyeccion = proyectarFlujo(ingresos, egresos, hoy);
    const confianza = confianzaPorOrigen("calculo");
    const recomendaciones: RecomendacionNueva[] = [];

    for (const bucket of proyeccion.buckets) {
      const severidad = SEVERIDAD_DEFICIT[bucket.rango];
      if (!severidad || bucket.neto >= 0) continue;

      recomendaciones.push({
        agentId: manifestFlujoCaja.id,
        tipo: "flujo_negativo",
        titulo: `Flujo negativo en ${bucket.rango} días: neto ${bucket.neto}`,
        descripcion: `Ingresos ${bucket.ingresos} vs egresos ${bucket.egresos} en la ventana ${bucket.rango}.`,
        estado: "proposed",
        severidad,
        confianza,
        origenConfianza: "calculo",
        prioridad: calcularPrioridad({ severidad, confianza, valorEsperado: bucket.neto }),
        impactoEstimado: bucket.neto,
        dedupKey: `flujo_caja:deficit:${bucket.rango}`,
        evidencia: { calculo: { rango: bucket.rango, ingresos: bucket.ingresos, egresos: bucket.egresos, neto: bucket.neto } },
      });
    }

    return {
      recomendaciones,
      resumen: `Proyección de caja: ingresos ${proyeccion.ingresosTotal}, egresos ${proyeccion.egresosTotal}, neto ${proyeccion.netoTotal}.`,
    };
  },
};
