"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { C } from "@/lib/ui";

type Severidad = "critica" | "importante" | "oportunidad";
interface Reco {
  id: string; agentId: string; tipo: string; titulo: string; descripcion?: string;
  severidad: Severidad; confianza: number; prioridad: number;
  impactoEstimado?: number | null; refEntidad?: { tipo: string; id: string };
}

interface Quien { nombre: string; rol: string; categoria: string }

const SEV: Record<Severidad, { label: string; color: string }> = {
  critica: { label: "Crítica", color: C.crit },
  importante: { label: "Importante", color: C.warn },
  oportunidad: { label: "Oportunidad", color: C.accent },
};
const ORDEN: Severidad[] = ["critica", "importante", "oportunidad"];

export default function BandejaPage() {
  const [recos, setRecos] = useState<Reco[]>([]);
  const [equipo, setEquipo] = useState<Record<string, Quien>>({});
  const [cargando, setCargando] = useState(true);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Severidad | "todas">("todas");

  async function cargar() {
    try {
      const [r, ag] = await Promise.all([fetch("/api/recommendations"), fetch("/api/agents")]);
      if (!r.ok) throw new Error(`GET /api/recommendations → ${r.status}`);
      setRecos(await r.json());
      if (ag.ok) {
        const lista = (await ag.json()) as { manifest: { id: string; categoria: string }; persona: { nombre: string; rol: string } }[];
        setEquipo(Object.fromEntries(lista.map((a) => [a.manifest.id, { nombre: a.persona.nombre, rol: a.persona.rol, categoria: a.manifest.categoria }])));
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { void cargar(); }, []);

  async function correr() {
    setCorriendo(true);
    try { await fetch("/api/run", { method: "POST" }); await cargar(); }
    finally { setCorriendo(false); }
  }

  const visibles = filtro === "todas" ? recos : recos.filter((r) => r.severidad === filtro);
  const conteo = (s: Severidad) => recos.filter((r) => r.severidad === s).length;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 64px" }}>
      <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: C.accentInk, margin: 0 }}>
        agent-core · bandeja
      </p>
      <h1 style={{ fontSize: 32, margin: "6px 0 4px", letterSpacing: "-.02em" }}>Recomendaciones</h1>
      <p style={{ color: C.soft, marginTop: 0 }}>
        Lo que el equipo de agentes recomienda hacer, por prioridad. Corré el equipo desde la{" "}
        <a href="/consola" style={{ color: C.accentInk }}>consola</a> o acá mismo.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "16px 0 22px" }}>
        {(["todas", ...ORDEN] as const).map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{
              border: `1px solid ${filtro === f ? C.accent : C.line}`, background: filtro === f ? "#0f3330" : C.surface2,
              color: filtro === f ? C.accentInk : C.soft, borderRadius: 99, padding: "6px 13px", fontSize: 12.5, cursor: "pointer",
            }}>
            {f === "todas" ? `Todas (${recos.length})` : `${SEV[f].label} (${conteo(f)})`}
          </button>
        ))}
        <button onClick={correr} disabled={corriendo}
          style={{ marginLeft: "auto", background: C.accent, color: "#08211f", border: 0, borderRadius: 99, padding: "8px 16px", fontWeight: 600, cursor: corriendo ? "default" : "pointer", opacity: corriendo ? 0.6 : 1 }}>
          {corriendo ? "Corriendo…" : "▶ Correr equipo"}
        </button>
      </div>

      {error && <p style={{ color: C.crit, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>⚠ {error}</p>}
      {cargando ? (
        <p style={{ color: C.faint }}>Cargando…</p>
      ) : visibles.length === 0 ? (
        <p style={{ color: C.faint }}>
          No hay recomendaciones{filtro !== "todas" ? ` ${SEV[filtro].label.toLowerCase()}s` : ""}. Corré el equipo para generarlas.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {visibles.map((r) => (
            <article key={r.id} style={{
              border: `1px solid ${C.line}`, borderLeft: `4px solid ${SEV[r.severidad].color}`,
              background: C.surface, borderRadius: 10, padding: "13px 15px",
            }}>
              {equipo[r.agentId] && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Avatar nombre={equipo[r.agentId]!.nombre} categoria={equipo[r.agentId]!.categoria} size={26} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{equipo[r.agentId]!.nombre}</span>
                  <span style={{ fontSize: 12, color: C.faint }}>· {equipo[r.agentId]!.rol}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>{r.titulo}</h3>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: SEV[r.severidad].color, whiteSpace: "nowrap" }}>
                  p{r.prioridad} · {SEV[r.severidad].label}
                </span>
              </div>
              {r.descripcion && <p style={{ margin: "6px 0 0", fontSize: 13, color: C.soft }}>{r.descripcion}</p>}
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.faint, marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>{r.tipo}</span>
                <span>· confianza {r.confianza}</span>
                {r.refEntidad && <span>· {r.refEntidad.tipo}:{r.refEntidad.id}</span>}
                {r.impactoEstimado != null && <span>· ${r.impactoEstimado.toLocaleString("es-AR")}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
