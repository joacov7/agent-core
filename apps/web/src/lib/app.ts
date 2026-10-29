import { crearApp } from "@agent-core/app-ejemplo";
import { crearServicio, type Servicio } from "@/lib/service";
import { crearIA } from "@/lib/ia";

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
export const servicio: Servicio = crearServicio({
  store: dev.store,
  providers: dev.providers,
  modeloNegocio: dev.modeloNegocio,
  // Chat con los agentes: Ollama local por defecto (ver `lib/ia.ts` y `.env.example`).
  ...(ia ? { ai: ia } : {}),
});
