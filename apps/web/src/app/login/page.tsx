"use client";

import { useState } from "react";
import { C } from "@/lib/ui";

/** Pantalla de ingreso. La API valida todo; esto solo muestra los mensajes. Tras entrar, va a donde se quería ir (`?next=`, que el servidor vuelve a validar). */
export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      const next = new URLSearchParams(window.location.search).get("next");
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario, clave, ...(next ? { next } : {}) }) });
      const d = (await r.json().catch(() => null)) as { error?: string; destino?: string } | null;
      if (r.ok && d?.destino) { window.location.assign(d.destino); return; } // navegación completa: así el servidor ya ve la cookie
      setError(d?.error ?? `No se pudo ingresar (${r.status}).`);
      setClave("");
    } catch {
      setError("No pude conectar con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  const campo: React.CSSProperties = { background: C.surface2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, width: "100%", boxSizing: "border-box" };
  return (
    <main style={{ maxWidth: 380, margin: "0 auto", padding: "72px 20px" }}>
      <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: C.accentInk, margin: 0 }}>agent-core</p>
      <h1 style={{ fontSize: 28, margin: "6px 0 4px", letterSpacing: "-.02em" }}>Ingresar</h1>
      <p style={{ color: C.soft, marginTop: 0 }}>Es el panel de tu equipo de agentes: pide clave porque ve datos de tus clientes.</p>
      <form onSubmit={entrar} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 22 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.soft }}>
          Usuario
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoFocus required maxLength={100} style={campo} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.soft }}>
          Clave
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required maxLength={1024} style={campo} />
        </label>
        {error && <p role="alert" style={{ color: C.crit, fontSize: 13, margin: 0 }}>⚠ {error}</p>}
        <button type="submit" disabled={enviando || !usuario || !clave}
          style={{ background: C.accent, color: "#08211f", border: 0, borderRadius: 99, padding: "11px 18px", fontWeight: 700, fontSize: 15, cursor: enviando ? "default" : "pointer", opacity: enviando || !usuario || !clave ? 0.6 : 1 }}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
