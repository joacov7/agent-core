import { crearApp } from "@agent-core/app-ejemplo";
import { crearServicio, type Servicio } from "@/lib/service";
import { crearIA } from "@/lib/ia";
import { LINEAS } from "@/lib/lineas";
import { crearProvidersSeguridad, crearProvidersWisp, MODELO_NEGOCIO_SEGURIDAD, MODELO_NEGOCIO_WISP } from "@agent-core/app-wisp";
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
interface Instancia { servicios: Record<string, Servicio>; fuente: "wisp" | "demo" }
const g = globalThis as unknown as { __agentcore?: Instancia };

function crearInstancia(): Instancia {
  const dev = crearApp();
  const ia = crearIA(process.env, dev.store);
  const wispUrl = process.env.WISP_DATABASE_URL;
  const comun = { store: dev.store, ...(ia ? { ai: ia } : {}) }; // un solo store en memoria: sus filas ya van separadas por tenant

  // Fuente de datos: con WISP_DATABASE_URL, los datos REALES del WISP (guaynet, solo lectura); sin ella,
  // el adapter de ejemplo (retail demo). Un SERVICIO por línea/tenant: cada una con su adapter, sus
  // agentes encendidos y su bandeja. El store (config de agentes y recomendaciones) sigue en memoria.
  const servicios: Record<string, Servicio> = {};
  const pool = wispUrl ? poolWisp(wispUrl) : undefined;
  for (const linea of LINEAS) {
    servicios[linea.tenantId] =
      linea.id === "internet" && pool
        ? crearServicio({ ...comun, providers: crearProvidersWisp({ db: pool, tenantId: linea.tenantId }), modeloNegocio: MODELO_NEGOCIO_WISP })
        : linea.id === "seguridad" && pool
          ? crearServicio({ ...comun, providers: crearProvidersSeguridad({ db: pool, tenantId: linea.tenantId }), modeloNegocio: MODELO_NEGOCIO_SEGURIDAD })
          : crearServicio({ ...comun, providers: dev.providers, modeloNegocio: dev.modeloNegocio });
  }
  return { servicios, fuente: wispUrl ? "wisp" : "demo" };
}

const instancia = (g.__agentcore ??= crearInstancia());
export const FUENTE: "wisp" | "demo" = instancia.fuente;

/** El servicio de una línea (por su tenant). Un tenant desconocido es un error: nunca cae a otra línea. */
export function servicioDe(tenantId: string): Servicio {
  const s = instancia.servicios[tenantId];
  if (!s) throw new Error(`Línea desconocida: ${tenantId}`);
  return s;
}
