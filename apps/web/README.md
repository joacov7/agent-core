# @agent-core/web — app SaaS (Next.js)

Esqueleto del producto: Next.js (App Router) sobre `agent-core`. Expone la **API** de
agentes y un **panel** que corre la capa de servicio en el servidor.

> Es **workspace del monorepo** (resuelve `@agent-core/*` por symlink), pero se corre
> aparte con `npm run dev`. El CI de la raíz (`tsc --build` + vitest) no la compila —
> `next build` es su propio paso. La **capa de servicio** (`src/lib/service.ts`) sí se
> testea en el vitest de la raíz.

## Correr en DEV (sin claves, sin DB)
Usa el adapter de referencia in-memory (retail), así ves todo funcionando ya:

```bash
# 1. desde la raíz del repo: instala todo y compila los paquetes (genera dist/)
npm install
npm run build

# 2. levantá la app
cd apps/web
cp .env.example .env
npm run dev          # http://localhost:3000
```

> El paso `npm run build` de la raíz es necesario la primera vez (y tras tocar un
> paquete `@agent-core/*`): la app importa su `dist/`.

- **Panel** (`/`): estado real del equipo de agentes del tenant.
- **Consola** (`/consola`): página cliente que consume la API — encendés/apagás agentes,
  ajustás autonomía y plan (persisten vía `PUT /api/agents`) y corrés el equipo
  (`POST /api/run`). Es la versión "conectada" de la consola visual (same-origin, sin la
  limitación de CSP del artifact).
- **Bandeja** (`/bandeja`): las recomendaciones que generan los agentes, por prioridad,
  con filtro por severidad y un botón para correr el equipo.
- **API**:
  - `GET  /api/agents` → agentes con disponibilidad + config del tenant.
  - `PUT  /api/agents` → encender/apagar/ajustar un agente (`AgenteConfigInput`).
  - `POST /api/run` → corre los agentes **encendidos** y devuelve lo ejecutado.
  - `GET  /api/recommendations` → bandeja del tenant, ordenada por prioridad.

El tenant sale de `resolveTenant()` (header `x-tenant-id` o `DEV_TENANT`).

## Pasar a PRODUCCIÓN
1. **Persistencia real** — en `src/lib/app.ts`, reemplazá el adapter in-memory por el
   store Prisma + tus providers:
   ```ts
   import { PrismaClient } from "@prisma/client";
   import { crearCoreStorePrisma } from "@agent-core/store-prisma";
   const store = crearCoreStorePrisma(new PrismaClient());
   const providers = crearTusProviders();          // adapters de tu dominio → canónico
   export const servicio = crearServicio({ store, providers, modeloNegocio: "transaccional_repetitivo" });
   ```
   Migrá la DB con el schema de `@agent-core/store-prisma` (`prisma/schema.prisma`).
2. **Auth (Clerk)** — en `src/lib/tenant.ts`, reemplazá el stub por el `orgId` de la
   sesión (`auth()` de `@clerk/nextjs/server`) y agregá `clerkMiddleware` en
   `src/middleware.ts`. Seteá `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`.
3. **Consola** — apuntá la consola visual a `GET/PUT /api/agents` en vez de localStorage.

## Capas
`page/route (Next)` → `resolveTenant` + `servicio` → `@agent-core/core` (`runSeleccion`,
activación, selección) → `CoreStore` (in-memory en dev, Prisma en prod) + providers.
