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
  - `GET  /api/lineas` → las líneas (internet, seguridad) y la activa en este navegador. El resto de la API usa la línea de la cookie `linea`.
  - `GET  /api/agents` → agentes con disponibilidad + config del tenant.
  - `PUT  /api/agents` → encender/apagar/ajustar un agente (`AgenteConfigInput`); `alias` lo
    renombra (≤40 caracteres → si no, `400`). Sin `alias` en el body se conserva el actual; `""` lo borra.
  - `POST /api/run` → corre los agentes **encendidos** y devuelve lo ejecutado.
  - `GET  /api/recommendations` → bandeja del tenant, ordenada por prioridad.
  - `GET /api/asistente` → estado de los avisos (sin token ni chat ids) · `POST /api/asistente/prueba` → mensaje de prueba por Telegram.
  - `POST /api/chat` → `{ agentId, messages:[{role:"user"|"assistant", content}] }` → `{ respuesta, modelo, uso }`.
    Errores: `400` input inválido (el rol `system` solo lo pone el server), `429` tope de gasto,
    `503` sin IA / modelo caído, `504` timeout.

El tenant sale de `resolveTenant()` (header `x-tenant-id` o `DEV_TENANT`).

## Datos reales de tu WISP (guaynet)
Con `WISP_DATABASE_URL` en el `.env`, la app lee la base de guaynet en **solo lectura** en vez de
los datos de ejemplo (la home lo indica). Guía completa, mapeo y el SQL del usuario de solo
lectura en [`apps/wisp`](../wisp/README.md). Sin esa variable sigue funcionando con el demo.

## Dos líneas: Internet y Seguridad
Internet y seguridad (el módulo de alarmas de guaynet) son **dos líneas de negocio, y cada una es su propio tenant**: su
equipo de agentes, su bandeja, su configuración y sus avisos. Con `SEGURIDAD=on` aparece un **selector** arriba (la elección
se guarda en una cookie). Así los agentes de cobro (cobros, morosidad…) existen solo en Internet, y Seguridad tiene los suyos:

| | Internet | Seguridad |
|---|---|---|
| Datos | clientes, facturas, pagos, routers | alertas, suscripciones, eventos y equipos de alarmas |
| Agentes disponibles | 15: cobros, morosidad, cobranza preventiva, flujo de caja, CRM, abandono, sistemas, **guardia**… | 7: **guardia**, agenda, sistemas, tareas, dirección, asistente |
| Se cobra | sí (facturas) | **todavía no** (por eso no hay agentes de cobro) |

Para activarla: corré `apps/wisp/sql/solo-lectura-seguridad.sql` además del de internet, y poné `SEGURIDAD=on` en el `.env`.
Cada línea lleva su estado de avisos (un resumen por mañana y por línea) y puede tener su **propio chat de Telegram**
(`TELEGRAM_CHAT_IDS_SEGURIDAD`, p.ej. el equipo de guardia). Los mensajes llevan la línea en el encabezado ("· 🛡️ Seguridad").
El **nombre del cliente** de cada hallazgo aparece en la bandeja de la app, pero **no** en Telegram (salvo `AVISOS_NOMBRES=on`).

## Avisos por Telegram (Asistente personal)
**Gael**, el Asistente personal, es el agente proactivo: te escribe por Telegram el **resumen de la
mañana** y te **avisa al instante** de lo urgente. **Solo avisa**: no ejecuta acciones ni toca ningún
sistema. Es el interruptor de los avisos: **apagado, no escribe nada**.

**Configurarlo (5 minutos):**
1. En Telegram hablale a **@BotFather** → `/newbot` → copiá el **token**.
2. Abrí tu bot y mandale **/start** (un bot no puede escribirle a quien no lo inició).
3. En `apps/web/.env`: `TELEGRAM_BOT_TOKEN=<token>` y corré `npm run telegram:chat-id`: te muestra tu
   **chat id**. Ponelo en `TELEGRAM_CHAT_IDS=<id>`.
4. Levantá la app: en la home, **"Enviar mensaje de prueba"** confirma que llega.
5. Para activar los avisos programados: `SCHEDULER=on` en el `.env`, reiniciá, y **encendé a Gael en `/consola`**
   (más los agentes que quieras que te informen).

**Qué manda y cuándo:**
| | |
|---|---|
| **Resumen** | Una vez por día a `RESUMEN_HORA` (08:00). Críticas, importantes y oportunidades, por agente. Si la app estuvo caída, se manda hasta 2 h tarde; pasado eso sería un resumen viejo y se omite. |
| **Alertas** | Cada `ALERTAS_CADA_MIN` (30) min revisa y avisa solo lo **crítico y nuevo**, una vez (no repite lo que ya estaba en el resumen). Nunca en la franja `ALERTAS_SILENCIO` (22:00–08:00) y con tope de `ALERTAS_MAX_DIA` (5) mensajes por día; lo que quede aparece en el resumen de mañana. |

**Garantías:**
- **Solo envía.** No hay webhook ni comandos entrantes: no expone ningún puerto y nadie puede darle órdenes al sistema por el chat.
- **Manda solo a `TELEGRAM_CHAT_IDS`** (lista cerrada). El token nunca aparece en logs, errores ni respuestas de la API.
- **Privacidad:** por defecto los mensajes **no llevan nombres de clientes** (solo tipos y montos): los chats normales de
  Telegram no tienen cifrado de extremo a extremo. `AVISOS_NOMBRES=on` los incluye.
- Si Telegram o la base fallan, **no se da el aviso por enviado**: se reintenta (el resumen a los 10 min) y el error queda en el log.
- El estado (qué se avisó) se guarda en `.agentcore/estado-avisos.json` (permisos 600): **reiniciar no reenvía** el resumen de hoy ni repite alertas.
- Una sola revisión a la vez, y el motor **deduplica**: correr el equipo muchas veces no duplica la bandeja ni los avisos.

**Ojo:** `GET /api/asistente` y `POST /api/asistente/prueba` no tienen login todavía (como el resto de la app): mantené la
app en `127.0.0.1` o dentro de tu red. La prueba está limitada a una cada 30 s. Un solo programador atiende **todas las líneas**,
cada una con su servicio, su estado persistido y su canal.

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
