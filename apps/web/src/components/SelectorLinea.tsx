"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/ui";

interface LineaVista { id: string; nombre: string; icono: string }

/**
 * Selector de línea de negocio (Internet / Seguridad). Cada línea es su propio tenant: su equipo de
 * agentes, su bandeja y sus avisos. Se guarda en una cookie y recarga. Si hay una sola línea, no se muestra.
 */
export function SelectorLinea() {
  const [d, setD] = useState<{ lineas: LineaVista[]; actual: string } | null>(null);
  useEffect(() => {
    void fetch("/api/lineas").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => setD(null));
  }, []);
  if (!d || d.lineas.length < 2) return null;

  function elegir(id: string) {
    document.cookie = `linea=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }
  return (
    <nav aria-label="Línea de negocio" style={{ display: "flex", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${C.line}`, background: C.surface, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.faint, letterSpacing: ".12em", textTransform: "uppercase" }}>línea</span>
      {d.lineas.map((l) => {
        const activa = l.id === d.actual;
        return (
          <button key={l.id} onClick={() => !activa && elegir(l.id)} aria-pressed={activa}
            style={{ border: `1px solid ${activa ? C.accent : C.line}`, background: activa ? "#0f3330" : C.surface2, color: activa ? C.accentInk : C.soft, borderRadius: 99, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: activa ? "default" : "pointer" }}>
            {l.icono} {l.nombre}
          </button>
        );
      })}
    </nav>
  );
}
