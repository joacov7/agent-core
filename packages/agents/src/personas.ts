import type { PersonaAgente } from "@agent-core/contracts";

/**
 * Persona por defecto de cada agente del catálogo: un nombre propio y un saludo en
 * primera persona. Es solo presentación — los nombres son neutros en género y el tenant
 * puede renombrar cualquiera con `AgenteConfig.alias`.
 */
export const personas: Record<string, PersonaAgente> = {
  ceo: { nombre: "Alex", saludo: "Te resumo cómo viene el negocio y qué decisiones no pueden esperar." },
  asistente: { nombre: "Gael", saludo: "Te escribo cada mañana con lo importante y te aviso al instante si pasa algo grave." },
  jefe: { nombre: "Sol", saludo: "Ordeno las prioridades del equipo para que sepas por dónde empezar." },
  analista: { nombre: "Noa", saludo: "Leo lo que encontraron los demás y te lo explico con números." },
  crm: { nombre: "Dani", saludo: "Cuido la relación con cada cliente y aviso cuando alguno se enfría." },
  oportunidades: { nombre: "Ari", saludo: "Busco ventas que se te están escapando entre lo que ya comprás." },
  seguimiento: { nombre: "Cris", saludo: "Mantengo vivo el pipeline: nada se queda sin respuesta." },
  riesgo_abandono: { nombre: "Kai", saludo: "Detecto clientes que están por irse antes de que se vayan." },
  postventa: { nombre: "Lupe", saludo: "Me ocupo de que el cliente vuelva a comprar y deje su reseña." },
  nps: { nombre: "Emi", saludo: "Mido cómo te perciben y salgo a hablar con los detractores." },
  whatsapp: { nombre: "Cami", saludo: "Ordeno las conversaciones y marco las que necesitan una respuesta ya." },
  competencia: { nombre: "Rio", saludo: "Vigilo a la competencia y te cuento cuando se mueve." },
  precios: { nombre: "Fran", saludo: "Propongo ajustes de precio según mercado y margen." },
  ventas: { nombre: "Gabi", saludo: "Sigo el embudo comercial y marco dónde se está frenando." },
  prospeccion: { nombre: "Nico", saludo: "Encuentro prospectos nuevos que encajan con tu negocio." },
  cobros: { nombre: "Lou", saludo: "Te aviso qué cobros están vencidos y a quién conviene llamar primero." },
  morosidad: { nombre: "Maxi", saludo: "Sigo de cerca la mora avanzada para que no se vuelva incobrable." },
  cobranza_preventiva: { nombre: "Juli", saludo: "Me adelanto: aviso antes de que un cobro llegue a vencer." },
  flujo_caja: { nombre: "Eli", saludo: "Proyecto tu caja para que no te sorprenda ningún mes." },
  rentabilidad: { nombre: "Tomi", saludo: "Te muestro qué se vende mucho pero deja poco." },
  inventario: { nombre: "Fede", saludo: "Cuido el stock: aviso quiebres y excedentes a tiempo." },
  compras: { nombre: "Mica", saludo: "Armo qué reponer y a quién, según stock y proveedores." },
  logistica: { nombre: "Pau", saludo: "Sigo los envíos y marco los que se están demorando." },
  produccion: { nombre: "Sami", saludo: "Vigilo la producción para que cumpla los plazos." },
  sistemas: { nombre: "Yuri", saludo: "Priorizo los incidentes de software por impacto real." },
  agenda: { nombre: "Ale", saludo: "Cuido tu calendario: vencimientos, audiencias y compromisos." },
  compliance: { nombre: "Rami", saludo: "Reviso que cada obligación regulatoria tenga su respaldo antes de vencer." },
  rrhh: { nombre: "Toni", saludo: "Te aviso los hitos de tu gente: pruebas que terminan, revisiones pendientes." },
  tareas: { nombre: "Luka", saludo: "Convierto lo que hay que hacer en tareas concretas con dueño." },
};

/** Persona del agente; si no hay una definida, cae a un nombre derivado del id. */
export function personaDe(agentId: string): PersonaAgente {
  return personas[agentId] ?? { nombre: agentId, saludo: "" };
}
