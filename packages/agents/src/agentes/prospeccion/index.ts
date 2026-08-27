import type {
  Agent, AgentContext, AgentManifest, AgentRunOutput, RecomendacionNueva,
} from "@agent-core/contracts";
import { calcularPrioridad } from "@agent-core/core";
import { detectarProspectos, type SenalProspecto } from "./prospeccion.logic.js";

export * from "./prospeccion.logic.js";

/**
 * Prospección. Prioriza prospectos de fuentes externas por encaje y descarta los
 * que ya están en la base (dedup por email/teléfono). No asume rubro ni cadencia:
 * sirve para cualquier negocio que aporte la capacidad `external-sources`.
 */
export const manifestProspeccion: AgentManifest = {
  id: "prospeccion",
  version: "0.1.0",
  nombre: "Prospección",
  descripcion: "Detecta prospectos nuevos desde fuentes externas y los prioriza por encaje, excluyendo los que ya están en la base.",
  categoria: "comercial",
  requiereCapacidades: ["contacts", "external-sources"],
  requiereTools: ["consultar_contactos", "consultar_fuentes_externas"],
  nivelIA: "ninguno",
  costoEstimado: "cero",
  frecuenciaRecomendada: "semanal",
  emiteAcciones: false,
  toolsDeEscritura: [],
  riesgo: "bajo",
  autonomiaMaxima: "manual",
};

export const agenteProspeccion: Agent = {
  manifest: manifestProspeccion,
  async run({ ctx, providers }: AgentContext): Promise<AgentRunOutput> {
    if (!providers.externalSources || !providers.contacts) {
      return { recomendaciones: [], resumen: "Faltan capacidades external-sources/contacts." };
    }

    const [prospectosPage, contactosPage] = await Promise.all([
      providers.externalSources.prospects(ctx),
      providers.contacts.list(ctx),
    ]);

    // Claves de la base para descartar prospectos que ya son contactos.
    const clavesBase: string[] = [];
    for (const c of contactosPage.items) {
      for (const e of c.emails ?? []) clavesBase.push(e);
      for (const t of c.telefonos ?? []) clavesBase.push(t);
      for (const m of c.medios ?? []) clavesBase.push(m.valor);
    }

    const senales: SenalProspecto[] = prospectosPage.items.map((s) => ({
      id: s.id,
      fuente: s.fuente,
      nombre: s.nombre,
      clave: s.clave ?? null,
      motivo: s.motivo ?? null,
      score: s.score ?? null,
    }));

    const prospectos = detectarProspectos(senales, clavesBase);
    const recomendaciones: RecomendacionNueva[] = prospectos.map((p) => ({
      agentId: manifestProspeccion.id,
      tipo: "prospecto",
      titulo: `Prospecto: ${p.nombre} (${p.fuente})`,
      descripcion: p.motivo ?? `Señal de ${p.fuente} sin motivo declarado.`,
      estado: "proposed",
      severidad: "oportunidad",
      confianza: p.confianza,
      prioridad: calcularPrioridad({ severidad: "oportunidad", confianza: p.confianza, valorEsperado: null }),
      refEntidad: { tipo: "senal_externa", id: p.id },
      dedupKey: `prospeccion:prospecto:${p.clave ?? p.id}`,
      evidencia: {
        observado: { fuente: p.fuente, clave: p.clave, motivo: p.motivo },
        fuentes: [{ fuente: p.fuente }],
      },
    }));

    return { recomendaciones, resumen: `${recomendaciones.length} prospecto(s) priorizado(s).` };
  },
};
