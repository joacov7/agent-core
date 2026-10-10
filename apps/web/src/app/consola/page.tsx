"use client";

import { useEffect, useState } from "react";

type Autonomia = "manual" | "assisted" | "autonomous";
interface Manifest {
  id: string; nombre: string; categoria: string; autonomiaMaxima: Autonomia;
  riesgo: string; nivelIA: string;
}
interface AgenteVista {
  manifest: Manifest; disponible: boolean; encendido: boolean; autonomia: Autonomia; plan?: string;
}

const ORDEN_AUT: Autonomia[] = ["manual", "assisted", "autonomous"];
const AUT_LABEL: Record<Autonomia, string> = { manual: "Manual", assisted: "Asistido", autonomous: "Autónomo" };
const CAT_LABEL: Record<string, string> = {
  direccion: "Dirección", clientes: "Clientes", comercial: "Comercial", finanzas: "Finanzas",
  operaciones: "Operaciones", comunicacion: "Comunicación", organizacion: "Organización",
};
const CAT_ORDEN = ["direccion", "clientes", "comercial", "finanzas", "operaciones", "comunicacion", "organizacion"];
const TIERS = ["Free", "Pro", "Premium"];

const C = {
  bg: "#0e1315", surface: "#161d20", surface2: "#1b2327", line: "#2a343a",
  ink: "#e7ecee", soft: "#a3b0b6", faint: "#6c7c83", accent: "#2bb8ab", accentInk: "#7fd8ce",
  warn: "#d69a3a", crit: "#e0685a",
};

export default function ConsolaPage() {
  const [agentes, setAgentes] = useState<AgenteVista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [resultado, setResultado] = useState<{ ejecutados: { agentId: string; recomendaciones: number }[]; total: number } | null>(null);

  async function cargar() {
    try {
      const r = await fetch("/api/agents");
      if (!r.ok) throw new Error(`GET /api/agents → ${r.status}`);
      setAgentes(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { void cargar(); }, []);

  async function patch(v: AgenteVista, cambios: Partial<{ encendido: boolean; autonomia: Autonomia; plan: string }>) {
    const next = { ...v, ...cambios };
    setAgentes((xs) => xs.map((x) => (x.manifest.id === v.manifest.id ? next : x))); // optimista
    const body = { agentId: v.manifest.id, encendido: next.encendido, autonomia: next.autonomia, ...(next.plan ? { plan: next.plan } : {}) };
    try {
      const r = await fetch("/api/agents", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      void cargar(); // revertir desde el server si falló
    }
  }

  async function correr() {
    setCorriendo(true); setResultado(null);
    try {
      const r = await fetch("/api/run", { method: "POST" });
      setResultado(await r.json());
    } finally {
      setCorriendo(false);
    }
  }

  const disponibles = agentes.filter((a) => a.disponible);
  const encendidos = disponibles.filter((a) => a.encendido);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 64px" }}>
      <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: C.accentInk, margin: 0 }}>
        agent-core · consola · en vivo
      </p>
      <h1 style={{ fontSize: 32, margin: "6px 0 4px", letterSpacing: "-.02em" }}>Consola de Agentes</h1>
      <p style={{ color: C.soft, marginTop: 0 }}>
        Conectada a la API: <code>GET/PUT /api/agents</code> · <code>POST /api/run</code>. Los cambios se persisten
        en el <code>CoreStore</code> del tenant.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "16px 0 24px" }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.faint }}>
          {disponibles.length} disponibles · {encendidos.length} encendidos
        </span>
        <button onClick={correr} disabled={corriendo || encendidos.length === 0}
          style={{ marginLeft: "auto", background: C.accent, color: "#08211f", border: 0, borderRadius: 99, padding: "9px 18px", fontWeight: 600, cursor: corriendo ? "default" : "pointer", opacity: corriendo || encendidos.length === 0 ? 0.6 : 1 }}>
          {corriendo ? "Corriendo…" : "▶ Correr equipo"}
        </button>
      </div>

      {error && <p style={{ color: C.crit, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>⚠ {error}</p>}
      {cargando && <p style={{ color: C.faint }}>Cargando…</p>}

      {resultado && (
        <div style={{ border: `1px solid ${C.accent}`, background: "#0f3330", borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
          <b>Última corrida:</b> {resultado.total} recomendación(es) de {resultado.ejecutados.length} agente(s).
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.soft, marginTop: 6 }}>
            {resultado.ejecutados.map((e) => `${e.agentId} (${e.recomendaciones})`).join(" · ")}
          </div>
        </div>
      )}

      {CAT_ORDEN.filter((cat) => agentes.some((a) => a.manifest.categoria === cat)).map((cat) => {
        const items = agentes.filter((a) => a.manifest.categoria === cat);
        return (
          <section key={cat} style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 15, margin: "0 0 10px", color: C.ink }}>{CAT_LABEL[cat] ?? cat}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
              {items.map((a) => (
                <AgenteCard key={a.manifest.id} a={a} onPatch={patch} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function AgenteCard({ a, onPatch }: { a: AgenteVista; onPatch: (v: AgenteVista, c: Partial<{ encendido: boolean; autonomia: Autonomia; plan: string }>) => void }) {
  const opts = ORDEN_AUT.slice(0, ORDEN_AUT.indexOf(a.manifest.autonomiaMaxima) + 1);
  const dis = !a.disponible;
  return (
    <div style={{
      border: `1px solid ${a.encendido ? C.accent : C.line}`, borderRadius: 12, padding: "13px 14px",
      background: dis ? "#121819" : C.surface, opacity: dis ? 0.55 : 1, display: "flex", flexDirection: "column", gap: 9,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{a.manifest.nombre}</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: C.faint, marginTop: 2 }}>
            {a.manifest.id} · {a.manifest.nivelIA !== "ninguno" ? "IA" : "sin IA"} · riesgo {a.manifest.riesgo}
          </div>
        </div>
        <button role="switch" aria-checked={a.encendido} disabled={dis}
          onClick={() => onPatch(a, { encendido: !a.encendido })}
          style={{ width: 42, height: 24, borderRadius: 99, border: `1px solid ${a.encendido ? C.accent : C.line}`, background: a.encendido ? C.accent : C.surface2, position: "relative", cursor: dis ? "not-allowed" : "pointer", flex: "0 0 auto" }}>
          <span style={{ position: "absolute", top: 2, left: a.encendido ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .14s" }} />
        </button>
      </div>

      {dis ? (
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.crit }}>no disponible (falta capacidad/cadencia)</div>
      ) : a.encendido ? (
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
          <label style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.faint, display: "flex", gap: 6, alignItems: "center" }}>
            autonomía
            <select value={a.autonomia} onChange={(e) => onPatch(a, { autonomia: e.target.value as Autonomia })}
              style={{ background: C.surface2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 7, padding: "4px 7px", fontSize: 12 }}>
              {opts.map((o) => <option key={o} value={o}>{AUT_LABEL[o]}</option>)}
            </select>
          </label>
          <div style={{ display: "inline-flex", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
            {TIERS.map((t) => (
              <button key={t} onClick={() => onPatch(a, { plan: t })}
                style={{ border: 0, borderRight: `1px solid ${C.line}`, background: (a.plan ?? "Pro") === t ? C.accent : C.surface2, color: (a.plan ?? "Pro") === t ? "#08211f" : C.soft, fontFamily: "ui-monospace, monospace", fontSize: 11, padding: "5px 9px", cursor: "pointer" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.faint }}>disponible · apagado</div>
      )}
    </div>
  );
}
