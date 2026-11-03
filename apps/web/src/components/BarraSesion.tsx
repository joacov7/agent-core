"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/ui";

/** Botón "Salir" (arriba a la derecha) cuando hay una sesión. No aparece en la pantalla de ingreso ni si el acceso está apagado. */
export function BarraSesion() {
  const [usuario, setUsuario] = useState<string | null>(null);
  useEffect(() => {
    if (window.location.pathname === "/login") return;
    void fetch("/api/auth/estado").then((r) => (r.ok ? r.json() : null)).then((d: { autenticado?: boolean; usuario?: string } | null) => setUsuario(d?.autenticado ? d.usuario ?? "" : null)).catch(() => setUsuario(null));
  }, []);
  if (usuario === null) return null;
  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/login");
  }
  return (
    <button onClick={salir} title={`Cerrar la sesión de ${usuario}`}
      style={{ position: "fixed", top: 10, right: 14, zIndex: 10, background: C.surface2, color: C.soft, border: `1px solid ${C.line}`, borderRadius: 99, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
      Salir{usuario ? ` · ${usuario}` : ""}
    </button>
  );
}
