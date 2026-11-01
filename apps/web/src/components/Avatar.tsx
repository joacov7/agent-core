"use client";

import { useState } from "react";
import { CAT_COLOR, C } from "@/lib/ui";

/**
 * Avatar del agente: su foto si el tenant le puso una; si no, la inicial del nombre sobre el color del área
 * (sin imágenes → escala a cualquier tenant). Si la foto no carga, vuelve al avatar generado.
 */
export function Avatar({ nombre, categoria, size = 40, estadoColor, fotoUrl }: {
  nombre: string; categoria: string; size?: number; estadoColor?: string; fotoUrl?: string;
}) {
  const [fallo, setFallo] = useState(false);
  const foto = fotoUrl && !fallo ? fotoUrl : undefined;
  const color = CAT_COLOR[categoria] ?? C.accent;
  return (
    <span aria-hidden style={{ position: "relative", display: "inline-block", width: size, height: size, flex: "0 0 auto" }}>
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto servida por la propia API; no pasa por el optimizador de Next
        <img src={foto} alt="" width={size} height={size} onError={() => setFallo(true)}
          style={{ display: "block", width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${color}`, boxSizing: "border-box" }} />
      ) : (
        <span style={{
          display: "grid", placeItems: "center", width: size, height: size, borderRadius: "50%",
          background: `${color}26`, border: `2px solid ${color}`, color,
          fontWeight: 700, fontSize: Math.round(size * 0.42), lineHeight: 1,
        }}>
          {nombre.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
      {estadoColor && (
        <span style={{
          position: "absolute", right: -1, bottom: -1, width: Math.max(9, size * 0.26), height: Math.max(9, size * 0.26),
          borderRadius: "50%", background: estadoColor, border: `2px solid ${C.surface}`,
        }} />
      )}
    </span>
  );
}
