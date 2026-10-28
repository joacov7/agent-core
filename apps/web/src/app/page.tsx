import { servicio } from "@/lib/app";
import { Avatar } from "@/components/Avatar";
import { C, CAT_LABEL, CAT_ORDEN, ESTADO } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Server component: la vista de equipo. Muestra quién está en el equipo del tenant, qué
// está haciendo cada agente ahora y cuántas novedades tiene.
export default async function Home() {
  const ctx = { tenantId: process.env.DEV_TENANT ?? "demo" };
  const agentes = await servicio.listarAgentes(ctx);
  const disponibles = agentes.filter((a) => a.disponible);
  const activos = disponibles.filter((a) => a.encendido);
  const novedades = agentes.reduce((n, a) => n + a.novedades, 0);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px 64px" }}>
      <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: C.accent, margin: 0 }}>
        agent-core · equipo
      </p>
      <h1 style={{ fontSize: 34, margin: "8px 0 6px", letterSpacing: "-.02em" }}>Tu equipo IA</h1>
      <p style={{ color: C.soft, marginTop: 0 }}>
        Tenant <b>{ctx.tenantId}</b> · {activos.length} en guardia de {disponibles.length} disponibles
        {novedades > 0 ? ` · ${novedades} novedad${novedades === 1 ? "" : "es"} para revisar` : ""}.
      </p>
      <p style={{ marginTop: 4, display: "flex", gap: 18, flexWrap: "wrap" }}>
        <a href="/consola" style={{ color: C.accent, fontWeight: 600 }}>→ Consola (armar el equipo y correrlo)</a>
        <a href="/bandeja" style={{ color: C.accent, fontWeight: 600 }}>→ Bandeja de recomendaciones</a>
      </p>

      {CAT_ORDEN.filter((cat) => agentes.some((a) => a.manifest.categoria === cat)).map((cat) => (
        <section key={cat} style={{ marginTop: 26 }}>
          <h2 style={{ fontSize: 14, margin: "0 0 10px", color: C.soft, textTransform: "uppercase", letterSpacing: ".1em" }}>
            {CAT_LABEL[cat] ?? cat}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 10 }}>
            {agentes.filter((a) => a.manifest.categoria === cat).map((a) => {
              const est = ESTADO[a.estado];
              return (
                <div key={a.manifest.id} style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  border: `1px solid ${a.encendido ? C.accent : C.line}`, borderRadius: 12, padding: "12px 14px",
                  background: a.disponible ? C.surface : "#121819", opacity: a.disponible ? 1 : 0.5,
                }}>
                  <Avatar nombre={a.persona.nombre} categoria={cat} size={42} estadoColor={est.color} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {a.persona.nombre} <span style={{ fontWeight: 400, color: C.faint, fontSize: 13 }}>· {a.persona.rol}</span>
                    </div>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: est.color, marginTop: 3 }}>
                      {est.label}{a.novedades > 0 ? ` · ${a.novedades}` : ""}
                    </div>
                    {a.disponible && (
                      <div style={{ fontSize: 12.5, color: C.soft, marginTop: 6, lineHeight: 1.4 }}>“{a.persona.saludo}”</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
