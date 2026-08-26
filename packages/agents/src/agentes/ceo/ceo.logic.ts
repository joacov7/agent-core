// ─── CEO: lógica pura (sin DB) ───────────────────────────────────────────────
// Resume el estado del negocio a partir de las recomendaciones ya generadas:
// conteos por severidad + las prioridades del día. Determinístico (la IA solo
// podría redactar mejor el texto, nunca cambiar las prioridades).

export type SeveridadReco = "critica" | "importante" | "oportunidad";

export interface RecoResumen {
  severidad: SeveridadReco;
  prioridad: number;
  titulo: string;
}

export interface ResumenEjecutivo {
  conteos: { criticas: number; importantes: number; oportunidades: number };
  top: RecoResumen[];
  texto: string;
}

export function resumenEjecutivo(recos: RecoResumen[], topN = 5): ResumenEjecutivo {
  const conteos = {
    criticas: recos.filter((r) => r.severidad === "critica").length,
    importantes: recos.filter((r) => r.severidad === "importante").length,
    oportunidades: recos.filter((r) => r.severidad === "oportunidad").length,
  };
  const top = [...recos].sort((a, b) => a.prioridad - b.prioridad).slice(0, topN);

  const lineas: string[] = [];
  if (!recos.length) {
    lineas.push("Sin recomendaciones abiertas. Negocio en orden.");
  } else {
    lineas.push(`Estado: ${conteos.criticas} crítica(s), ${conteos.importantes} importante(s), ${conteos.oportunidades} oportunidad(es).`);
    top.forEach((r, i) => lineas.push(`Prioridad ${i + 1}: ${r.titulo}`));
  }
  return { conteos, top, texto: lineas.join("\n") };
}
