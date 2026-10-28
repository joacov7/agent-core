import { CAT_COLOR, C } from "@/lib/ui";

/** Avatar generado: inicial del nombre sobre el color del área. Sin imágenes → escala a cualquier tenant. */
export function Avatar({ nombre, categoria, size = 40, estadoColor }: {
  nombre: string; categoria: string; size?: number; estadoColor?: string;
}) {
  const color = CAT_COLOR[categoria] ?? C.accent;
  return (
    <span aria-hidden style={{ position: "relative", display: "inline-block", width: size, height: size, flex: "0 0 auto" }}>
      <span style={{
        display: "grid", placeItems: "center", width: size, height: size, borderRadius: "50%",
        background: `${color}26`, border: `2px solid ${color}`, color,
        fontWeight: 700, fontSize: Math.round(size * 0.42), lineHeight: 1,
      }}>
        {nombre.trim().charAt(0).toUpperCase() || "?"}
      </span>
      {estadoColor && (
        <span style={{
          position: "absolute", right: -1, bottom: -1, width: Math.max(9, size * 0.26), height: Math.max(9, size * 0.26),
          borderRadius: "50%", background: estadoColor, border: `2px solid ${C.surface}`,
        }} />
      )}
    </span>
  );
}
