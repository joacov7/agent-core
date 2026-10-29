import { crearApp } from "@agent-core/app-ejemplo";
import { crearServicio, type Servicio } from "@/lib/service";
import { crearIA } from "@/lib/ia";
import { tenantPorDefecto } from "@/lib/tenant";
import { crearProvidersWisp, MODELO_NEGOCIO_WISP } from "@agent-core/app-wisp";
import { poolWisp } from "@/lib/wisp";

// Wiring de la app. DEV: usa el adapter de referencia in-memory (retail) para que el
// SaaS corra sin DB ni claves y veas la API funcionando.
//
// PROD: reemplazá por tu CoreStore Prisma + tus providers reales, p.ej.
//   import { PrismaClient } from "@prisma/client";
//   import { crearCoreStorePrisma } from "@agent-core/store-prisma";
//   const store = crearCoreStorePrisma(new PrismaClient());
//   const providers = crearTusProviders();  // adapters de tu dominio → canónico
//   export const servicio = crearServicio({ store, providers, modeloNegocio: "transaccional_repetitivo" });
const dev = crearApp();
const ia = crearIA(process.env, dev.store);

// Fuente de datos: con WISP_DATABASE_URL, los datos REALES del WISP (guaynet, solo lectura,
// cadencia suscripción); sin ella, el adapter de ejemplo (retail demo). El store (config de
// agentes y recomendaciones) sigue en memoria: se pierde al reiniciar.
const wispUrl = process.env.WISP_DATABASE_URL;
export const FUENTE: "wisp" | "demo" = wispUrl ? "wisp" : "demo";

export const servicio: Servicio = crearServicio({
  store: dev.store,
  providers: wispUrl ? crearProvidersWisp({ db: poolWisp(wispUrl), tenantId: tenantPorDefecto() }) : dev.providers,
  modeloNegocio: wispUrl ? MODELO_NEGOCIO_WISP : dev.modeloNegocio,
  // Chat con los agentes: Ollama local por defecto (ver `lib/ia.ts` y `.env.example`).
  ...(ia ? { ai: ia } : {}),
});
