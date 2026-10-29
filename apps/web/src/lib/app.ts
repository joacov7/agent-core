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

// Singleton GLOBAL: Next compila `instrumentation.ts` (donde arranca el programador de avisos) y
// las rutas por separado, y cada bundle tendría SU PROPIA copia de este módulo → dos stores en
// memoria distintos (el programador miraría una bandeja y la web otra). Colgarlo de globalThis
// garantiza una sola instancia, y de paso que el estado no se pierda en cada recarga de `next dev`.
interface Instancia { servicio: Servicio; fuente: "wisp" | "demo" }
const g = globalThis as unknown as { __agentcore?: Instancia };

function crearInstancia(): Instancia {
  const dev = crearApp();
  const ia = crearIA(process.env, dev.store);

  // Fuente de datos: con WISP_DATABASE_URL, los datos REALES del WISP (guaynet, solo lectura,
  // cadencia suscripción); sin ella, el adapter de ejemplo (retail demo). El store (config de
  // agentes y recomendaciones) sigue en memoria: se pierde al reiniciar.
  const wispUrl = process.env.WISP_DATABASE_URL;
  return {
    fuente: wispUrl ? "wisp" : "demo",
    servicio: crearServicio({
      store: dev.store,
      providers: wispUrl ? crearProvidersWisp({ db: poolWisp(wispUrl), tenantId: tenantPorDefecto() }) : dev.providers,
      modeloNegocio: wispUrl ? MODELO_NEGOCIO_WISP : dev.modeloNegocio,
      // Chat con los agentes: Ollama local por defecto (ver `lib/ia.ts` y `.env.example`).
      ...(ia ? { ai: ia } : {}),
    }),
  };
}

const instancia = (g.__agentcore ??= crearInstancia());
export const servicio: Servicio = instancia.servicio;
export const FUENTE: "wisp" | "demo" = instancia.fuente;
