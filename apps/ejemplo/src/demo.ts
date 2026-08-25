import type { TenantCtx } from "@agent-core/contracts";
import { runAgent, manifestsActivables, capacidadesDeProviders } from "@agent-core/core";
import { catalogo } from "@agent-core/agents";
import { crearApp } from "./app.js";

// Corre el catálogo contra el adapter de referencia y loguea las recomendaciones.
// `npm run build && node apps/ejemplo/dist/demo.js` (o `npm run demo` dentro del paquete).
async function main(): Promise<void> {
  const app = crearApp();
  const ctx: TenantCtx = { tenantId: "demo", requestId: "demo-run" };
  const activables = manifestsActivables(catalogo, {
    capacidades: capacidadesDeProviders(app.providers), modeloNegocio: app.modeloNegocio,
  });
  console.log("Agentes activables:", activables.map((a) => a.manifest.id).join(", "));

  for (const agent of activables) {
    const { recomendaciones, resumen } = await runAgent({
      agent, ctx, providers: app.providers, store: app.store, modeloNegocio: app.modeloNegocio,
    });
    console.log(`\n[${agent.manifest.id}] ${resumen ?? ""}`);
    for (const r of recomendaciones) {
      console.log(`  - (${r.severidad}/p${r.prioridad}/conf ${r.confianza}) ${r.titulo}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
