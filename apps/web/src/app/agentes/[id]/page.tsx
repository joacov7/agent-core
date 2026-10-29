"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { C, ESTADO, type EstadoAgente, type PersonaVista } from "@/lib/ui";

interface AgenteVista {
  manifest: { id: string; categoria: string };
  persona: PersonaVista; estado: EstadoAgente; novedades: number; disponible: boolean;
}
interface Mensaje { role: "user" | "assistant"; content: string; error?: boolean }

const SUGERENCIAS = ["¿Qué encontraste?", "¿Por qué lo marcaste así?", "¿Qué me recomendás hacer primero?"];

export default function ChatAgentePage() {
  const { id } = useParams<{ id: string }>();
  const [agente, setAgente] = useState<AgenteVista | null | undefined>(undefined);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/agents");
        const lista = (await r.json()) as AgenteVista[];
        const a = lista.find((x) => x.manifest.id === id) ?? null;
        setAgente(a);
        if (a) setMensajes([{ role: "assistant", content: a.persona.saludo }]);
      } catch {
        setAgente(null);
      }
    })();
  }, [id]);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes, pensando]);

  async function enviar(contenido: string) {
    const t = contenido.trim();
    if (!t || pensando || !agente) return;
    // El saludo es de presentación (no lo dijo el modelo): no se manda como historial.
    const previos = mensajes.filter((m, i) => !m.error && !(i === 0 && m.role === "assistant"));
    const historial = [...previos, { role: "user" as const, content: t }];
    setMensajes((m) => [...m, { role: "user", content: t }]);
    setTexto(""); setPensando(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: id, messages: historial.map(({ role, content }) => ({ role, content })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setMensajes((m) => [...m, { role: "assistant", content: j.respuesta }]);
    } catch (e) {
      setMensajes((m) => [...m, { role: "assistant", error: true, content: e instanceof Error ? e.message : "Algo salió mal." }]);
    } finally {
      setPensando(false);
    }
  }

  if (agente === undefined) return <main style={{ padding: 40, color: C.faint }}>Cargando…</main>;
  if (agente === null) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 40 }}>
        <p>No encontré a ese agente. <a href="/" style={{ color: C.accentInk }}>Volver al equipo</a></p>
      </main>
    );
  }
  const est = ESTADO[agente.estado];

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 24px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <a href="/" style={{ color: C.faint, fontSize: 13 }}>← Equipo</a>
      <header style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0 16px" }}>
        <Avatar nombre={agente.persona.nombre} categoria={agente.manifest.categoria} size={48} estadoColor={est.color} />
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{agente.persona.nombre} <span style={{ color: C.faint, fontWeight: 400, fontSize: 15 }}>· {agente.persona.rol}</span></h1>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: est.color }}>
            {est.label}{agente.novedades > 0 ? ` · ${agente.novedades} novedad${agente.novedades === 1 ? "" : "es"}` : ""}
          </div>
        </div>
      </header>

      {!agente.disponible && (
        <p style={{ color: C.warn, fontSize: 13 }}>Este agente no está disponible en tu empresa (faltan datos). Igual podés charlar, pero no tiene nada para contarte.</p>
      )}
      {agente.disponible && agente.estado === "apagado" && (
        <p style={{ color: C.warn, fontSize: 13 }}>Está descansando: <a href="/consola" style={{ color: C.accentInk }}>encendelo en la consola</a> y corré el equipo para que tenga algo para contarte.</p>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, padding: "6px 0 14px" }}>
        {mensajes.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: 14.5,
            background: m.error ? "#2a1715" : m.role === "user" ? "#0f3330" : C.surface,
            border: `1px solid ${m.error ? C.crit : m.role === "user" ? C.accent : C.line}`,
            color: m.error ? C.crit : C.ink, borderRadius: 14, padding: "9px 13px",
          }}>
            {m.content}
          </div>
        ))}
        {pensando && (
          <div style={{ alignSelf: "flex-start", color: C.faint, fontSize: 13, fontStyle: "italic" }}>
            {agente.persona.nombre} está pensando… (un modelo local en CPU puede tardar unos segundos)
          </div>
        )}
        <div ref={fin} />
      </div>

      {mensajes.length <= 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {SUGERENCIAS.map((s) => (
            <button key={s} onClick={() => void enviar(s)} disabled={pensando}
              style={{ border: `1px solid ${C.line}`, background: C.surface2, color: C.soft, borderRadius: 99, padding: "6px 12px", fontSize: 12.5, cursor: "pointer" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void enviar(texto); }} style={{ display: "flex", gap: 8, position: "sticky", bottom: 16 }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} disabled={pensando}
          placeholder={`Escribile a ${agente.persona.nombre}…`} aria-label="Mensaje"
          style={{ flex: 1, background: C.surface2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 99, padding: "11px 16px", fontSize: 14.5 }} />
        <button type="submit" disabled={pensando || !texto.trim()}
          style={{ background: C.accent, color: "#08211f", border: 0, borderRadius: 99, padding: "0 20px", fontWeight: 600, cursor: "pointer", opacity: pensando || !texto.trim() ? 0.6 : 1 }}>
          Enviar
        </button>
      </form>
    </main>
  );
}
