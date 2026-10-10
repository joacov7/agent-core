import { servicio } from "@/lib/app";

// Server component: corre la capa de servicio en el servidor y muestra el estado real
// del equipo de agentes para el tenant dev. Prueba de que el motor + la API funcionan.
export default async function Home() {
  const ctx = { tenantId: process.env.DEV_TENANT ?? "demo" };
  const agentes = await servicio.listarAgentes(ctx);
  const disponibles = agentes.filter((a) => a.disponible);

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px" }}>
      <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "#2bb8ab", margin: 0 }}>
        agent-core · saas
      </p>
      <h1 style={{ fontSize: 34, margin: "8px 0 6px", letterSpacing: "-.02em" }}>Panel del equipo IA</h1>
      <p style={{ color: "#a3b0b6", marginTop: 0 }}>
        Tenant <b>{ctx.tenantId}</b> · {disponibles.length} de {agentes.length} agentes disponibles según las
        capacidades del adapter. Configuralos vía <code>PUT /api/agents</code> y corralos con <code>POST /api/run</code>.
      </p>
      <p style={{ marginTop: 4 }}>
        <a href="/consola" style={{ color: "#2bb8ab", fontWeight: 600 }}>→ Abrir la consola (configurar y correr en vivo)</a>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10, marginTop: 24 }}>
        {agentes.map((a) => (
          <div key={a.manifest.id} style={{
            border: "1px solid #2a343a", borderRadius: 10, padding: "12px 14px",
            background: a.disponible ? "#161d20" : "#121819", opacity: a.disponible ? 1 : 0.55,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{a.manifest.nombre}</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6c7c83", marginTop: 4 }}>
              {a.manifest.id} · {a.disponible ? (a.encendido ? "encendido" : "disponible") : "no disponible"}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
