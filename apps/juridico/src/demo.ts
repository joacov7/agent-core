import type { TenantCtx } from "@agent-core/contracts";
import { runAgent, manifestsActivables, capacidadesDeProviders } from "@agent-core/core";
import { catalogo } from "@agent-core/agents";
import { crearApp } from "./app.js";

// Corre el MISMO catálogo contra el adapter del estudio jurídico (cadencia proyecto).
// `npm run build && node apps/juridico/dist/demo.js`
async function main(): Promise<void> {
  const app = crearApp();
  const ctx: TenantCtx = { tenantId: "estudio", requestId: "demo-jur", now: () => new Date("2026-08-25T12:00:00.000Z") };
  const capacidades = capacidadesDeProviders(app.providers);
  const activables = manifestsActivables(catalogo, { capacidades, modeloNegocio: app.modeloNegocio });

  console.log(`Capacidades del estudio: ${capacidades.join(", ")}`);
  console.log(`Cadencia: ${app.modeloNegocio}`);
  console.log(`Agentes activables: ${activables.map((a) => a.manifest.id).join(", ")}\n`);

  for (const agent of activables) {
    const { recomendaciones, resumen } = await runAgent({
      agent, ctx, providers: app.providers, store: app.store, modeloNegocio: app.modeloNegocio,
    });
    console.log(`[${agent.manifest.id}] ${resumen ?? ""}`);
    for (const r of recomendaciones) console.log(`  - (${r.severidad}/p${r.prioridad}) ${r.titulo}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
