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

- **Equipo** (`/`): tu equipo IA con **cara y nombre** — cada agente es una persona (avatar
  generado por área, nombre propio, saludo) con su estado en vivo: *descansando*, *al día*,
  *con novedades* o *espera tu OK*.
- **Consola** (`/consola`): página cliente que consume la API — encendés/apagás agentes,
  les ponés **otro nombre** (✎), ajustás autonomía y plan (persisten vía `PUT /api/agents`) y corrés el equipo
  (`POST /api/run`). Es la versión "conectada" de la consola visual (same-origin, sin la
  limitación de CSP del artifact).
- **Bandeja** (`/bandeja`): las recomendaciones que generan los agentes (firmadas por su autor), por prioridad,
  con filtro por severidad y un botón para correr el equipo.
- **Chat** (`/agentes/<id>`, o tocá a cualquiera en `/`): conversás con un agente. Responde
  en su voz y **solo con lo que él mismo encontró** (sus recomendaciones abiertas). No puede
  ejecutar acciones desde el chat. Ver "IA del chat" más abajo.
- **API**:
  - `GET  /api/agents` → agentes con disponibilidad + config del tenant.
  - `PUT  /api/agents` → encender/apagar/ajustar un agente (`AgenteConfigInput`); `alias` lo
    renombra (≤40 caracteres → si no, `400`). Sin `alias` en el body se conserva el actual; `""` lo borra.
  - `POST /api/run` → corre los agentes **encendidos** y devuelve lo ejecutado.
  - `GET  /api/recommendations` → bandeja del tenant, ordenada por prioridad.
  - `POST /api/chat` → `{ agentId, messages:[{role:"user"|"assistant", content}] }` → `{ respuesta, modelo, uso }`.
    Errores: `400` input inválido (el rol `system` solo lo pone el server), `429` tope de gasto,
    `503` sin IA / modelo caído, `504` timeout.

El tenant sale de `resolveTenant()` (header `x-tenant-id` o `DEV_TENANT`).

## IA del chat
El chat usa un modelo por una API compatible con OpenAI. **Por defecto, Ollama local: gratis,
sin claves, y los datos no salen de tu máquina.** Sin modelo, todo lo demás de la app funciona
igual y el chat avisa que no puede conectar.

```bash
curl -fsSL https://ollama.com/install.sh | sh     # instala el servicio (puerto 11434)
ollama pull qwen2.5:1.5b                           # ~1,5 GB de RAM, anda sin GPU
```

| Equipo | Modelo sugerido |
|---|---|
| 4 GB de RAM, sin GPU | `qwen2.5:1.5b` (o `gemma2:2b`) |
| 8 GB | `llama3.2:3b` |
| con GPU / 16 GB+ | `qwen2.5:7b` o más |

Un modelo chico alcanza para explicar hallazgos y redactar respuestas cortas; **no** para analizar
un mercado ni razonar sobre cifras. Para cambiar de modelo o pasar a una API paga alcanza con el
`.env` (ver `.env.example`): `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`. `AI_PROVIDER=mock` da respuestas
falsas para probar la UI y `AI_PROVIDER=off` apaga el chat. El gasto se atribuye por tenant y agente
y se puede topar con `AI_BUDGET_TENANT`.

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

## Personas
El catálogo trae un nombre y un saludo por defecto para cada agente (`personas` en
`@agent-core/agents`, neutros en género y sin marcas). El tenant los pisa con
`AgenteConfig.alias`. Es solo presentación: no afecta activación ni enforcement.
