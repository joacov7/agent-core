# agent-core

Plataforma de agentes IA reutilizable por cualquier rubro. El Core **nunca toca la
base del negocio**: habla con capacidades a través de adaptadores. Modelo canónico
chico y universal (Contacto / Interacción / Tarea / Recomendación) + capacidades
opcionales + un catálogo de agentes que solo leen capacidades.

> Extraído conceptualmente del Equipo IA de *Regionales por Mayor*, sin ninguna
> dependencia de esa app (nada de productos, órdenes, Prisma de dominio).

## Monorepo (workspaces)

```
packages/
  contracts/     @agent-core/contracts     tipos canónicos + interfaces de providers + Manifest (sin lógica)
  agent-core/    @agent-core/core          engine, recommendations, policies, jefe-gabinete, resultados, memoria, ai-gateway
  agents/        @agent-core/agents        catálogo de agentes reutilizables (usan solo contracts + core)
  store-prisma/  @agent-core/store-prisma  adapter de persistencia del CoreStore sobre Postgres (Prisma)
  ai-openai/     @agent-core/ai-openai     proveedor de IA para APIs compatibles con OpenAI (Ollama local o nube)
  notify-telegram/ @agent-core/notify-telegram notificador por Telegram (solo envía)
```

Las **apps** (Regionales, jurídico, contable, …) viven fuera: aportan adapters
(dominio → canónico), domain tools, auth, resolución de tenant, schema y UI.

```
apps/
  ejemplo/       @agent-core/app-ejemplo      adapter de referencia in-memory (retail) + smoke e2e
  juridico/      @agent-core/app-juridico     segundo adapter (estudio jurídico, cadencia proyecto)
  marketplace/   @agent-core/app-marketplace  tercer adapter (marketplace de dos lados, tenant por vendedor)
  wisp/          @agent-core/app-wisp         cuarto adapter: un WISP real (guaynet, Postgres, solo lectura, cadencia suscripción)
  web/           @agent-core/web              app SaaS (Next.js): API + consola + bandeja (se corre con `npm run dev`)
```

> **Prueba de reutilización (tres rubros, cero cambios de agente):**
> - `apps/juridico`: datos legales (comitente→Contacto, honorario→Cobro,
>   audiencia→Evento, escrito→Documento, consulta→Oportunidad), cadencia `proyecto`.
>   Activa Cobros/Morosidad/Agenda/Compliance/Seguimiento/… y **desactiva solo**
>   Rentabilidad/Precios/Inventario/CRM/Churn.
> - `apps/marketplace`: marketplace de dos lados (comprador/vendedor→Contacto,
>   orden→Transaccion, liquidación→Cobro, publicación→CatalogoItem, carrito→
>   Oportunidad, reseña→RespuestaFeedback), cadencia `transaccional_repetitivo`,
>   **un tenant por vendedor**. Con 8 capacidades activa 20 agentes (CRM, venta
>   cruzada, cobranzas, inventario, competencia/precios, churn, NPS, ventas…) y
>   deja OFF los que piden capacidades ausentes (agenda, logística, producción, …).
>
> El **mismo catálogo** en los tres, sin tocar una línea de agente.

## Estado

- ✅ Scaffold del monorepo + `@agent-core/contracts` completo.
- ✅ `@agent-core/core`: `.logic` puros de Regionales portados casi tal cual
  (recommendations, policies, jefe-gabinete, resultados, memoria) como red de
  paridad. **Engine funcional**:
  - `runAgent`: falla cerrado sin `TenantCtx`, activa por manifest (capacidades
    derivadas de los providers + modelo de negocio) y persiste las recomendaciones.
  - `resolverSeleccion` / `runSeleccion`: capa de selección por tenant. Combina la
    activación (qué está DISPONIBLE) con la config guardada (`CoreStore.agentConfig`:
    qué está ENCENDIDO, con qué autonomía y en qué plan) y corre solo los agentes
    encendidos, con la autonomía efectiva acotada al máximo del manifest. Fail-closed:
    sin config, `pordefecto: "apagado"`.
  - `evaluarEscritura`: enforcement que intercepta toda tool de escritura
    (bloqueo por memoria + policies: límites, horarios, entidades protegidas, precio, autonomía).
  - `ejecutarAccion`: paso Acción → Resultado, con el gate del enforcement y
    persistencia del `ResultadoAccion`.
  - `registrarDecision`: write de memoria que el enforcement después lee.
  - `registrarImpacto`: paso Resultado → Impacto, persistido en `ImpactStore`.
  - AI Gateway (`crearAiGateway`): envuelve al `AiCompletionProvider` con
    presupuesto por tenant y por agente (falla cerrado al superarlo) y atribución
    de gasto (tarifario tokens→costo, persistido en `GastoStore`). Agnóstico del
    proveedor concreto.
- ✅ `@agent-core/agents`: catálogo con 30 agentes, **todos con `run()` funcional**.
  - dirección: `ceo`, `jefe` (Jefe de Gabinete), `analista` — leen las
    recomendaciones ya generadas (vía `CoreStore`) y las resumen/priorizan.
  - clientes: `crm`, `oportunidades`, `seguimiento` (pipeline), `riesgo_abandono`
    (churn), `postventa` (recompra/reseña), `nps` (feedback: calcula el NPS y abre
    seguimiento de detractores), más `whatsapp` (comunicación).
  - comercial: `competencia`, `precios` (competition + catalog; `precios` es
    accionable vía `aplicar_precio`, interceptado por el enforcement), `ventas` (pipeline),
    `prospeccion` (fuentes externas: prioriza prospectos por encaje y descarta los
    que ya están en la base).
  - finanzas: `cobros` (vencido), `morosidad` (mora avanzada), `cobranza_preventiva`
    (por vencer, antes de la mora) — los tres sobre receivables —, `flujo_caja`
    (receivables + suppliers opc.), `rentabilidad`.
  - operaciones: `inventario` (inventory), `compras` (suppliers + inventory),
    `logistica` (logistics), `produccion` (production), `sistemas` (incidents:
    triage determinístico de incidentes de software — severidad × frecuencia ×
    usuarios × recencia × entorno; solo prioriza, no toca código).
  - vigilancia: `guardia` (incidents): avisa cuando un incidente grave —pánico, intrusión, equipo caído— pasa los
    minutos que tolera su nivel sin que nadie lo tome. Mira el TIEMPO, no el impacto (el triage de `sistemas` no
    habría llevado un pánico a crítico).
  - organización: `agenda` (agenda), `compliance` (agenda + documents: obligaciones
    regulatorias por vencer sin documento de respaldo), `rrhh` (staff: hitos de
    personal — fin de período de prueba, revisiones de desempeño), `tareas`.
  Cada uno = `.logic` pura con tests + wrapper `Agent` con manifest completo
  (capacidades + cadencia). Catálogo base completo: `prospeccion` sumó la capacidad
  `external-sources` (prospectos/señales externas); `nps` y `rrhh` sumaron
  `feedback` y `staff`; `sistemas` sumó `incidents` (triage de bugs, primer paso
  hacia un autofix gateado por enforcement); `cobranza_preventiva` y
  `compliance` amplían finanzas y organización reutilizando capacidades ya modeladas.
- ✅ **Personas**: cada agente tiene nombre propio y saludo por defecto (`personas`), que el
  tenant puede renombrar (`AgenteConfig.alias`); la app web los muestra como un equipo con
  estado en vivo.
- ✅ **Chat con los agentes**: cada uno responde en su voz y solo con lo que encontró. La IA es
  un `AiCompletionProvider` intercambiable (`@agent-core/ai-openai`): Ollama local gratis por
  defecto, o cualquier API compatible con OpenAI, siempre detrás del AI Gateway (presupuesto +
  atribución de gasto).
- ✅ **Asistente personal proactivo** (`asistente`, "Gael"): por Telegram manda el resumen de la mañana y
  avisa lo urgente (una vez, con silencio nocturno y tope diario). Solo avisa, no actúa. El motor ahora
  **deduplica** las recomendaciones vivas (antes cada corrida las duplicaba).
- ✅ **Dos líneas de negocio, dos tenants** (internet y seguridad de guaynet): cada una con su adapter de solo lectura, su
  equipo de agentes, su bandeja y sus avisos por Telegram (a su propio chat). La Guardia vigila que lo grave no quede sin atender.
- ✅ Activación por manifest en el core (`esActivable`/`manifestsActivables`):
  capacidades ⊇ requeridas + modelo de negocio compatible.
- ✅ `@agent-core/app-ejemplo`: adapter de referencia in-memory (providers con
  datos sembrados + `CoreStore` con aislamiento por tenant + tools de escritura +
  mock de IA) y un **smoke test end-to-end** del bucle completo. `npm run build`
  y luego `node apps/ejemplo/dist/demo.js` corre el catálogo y loguea las recos.

**449 tests verdes** (435 sin DB + 14 de integración contra Postgres real) (vitest): paridad de los `.logic` + engine (activación,
selección por tenant, enforcement, ejecución, memoria, impacto) + AI gateway
(presupuesto/atribución) + adapter de persistencia Prisma + proveedor de IA OpenAI-compatible + capa de servicio del SaaS (incl. chat)
+ los 30 agentes del catálogo + smoke end-to-end de **tres** adapters (retail, jurídico
y marketplace).

## Principios

- **Multi-tenancy obligatorio:** todo pasa por `TenantCtx`. Sin tenant, el Core no
  ejecuta (falla cerrado).
- **Inversión de dependencia:** el Core recibe providers y un `CoreStore`; no importa
  Prisma ni servicios del dominio.
- **Auto-descubrible:** las capacidades disponibles se derivan de qué providers existen.
- **Contracts sin lógica:** solo tipos; cambia poco y lo importan todos.

## Decisiones de diseño (cerradas)

- **Entidades protegidas genéricas.** Las policies protegen `EntityRef` (`{ tipo, id }[]`
  en `GlobalPolicy.protectedEntities`), no `protected_products`/`protected_clients`. El
  caller declara las `entidadesAfectadas` por una acción y el enforcement las contrasta.
  Sin supuesto de rubro en el Core (sección 9 del documento).
- **Naming: camelCase en la superficie pública, snake_case interno en los `.logic`.**
  Todo `@agent-core/contracts` (el contrato que ven las apps) es camelCase canónico.
  Los módulos `.logic` portados de Regionales conservan sus DTOs snake_case
  (`RecoJefe`, `DecisionValue`, `MetricasCliente`, `RentabilidadItem`, …): son la red
  de paridad y renombrarlos sería churn cosmético sin valor. El mapeo canónico → DTO
  vive aislado en cada agente/engine (p. ej. `aMetricas`, `aItem`). Regla: si es
  público, camelCase; si es un DTO interno de un `.logic`, se deja como vino.

## Scripts

```bash
npm install
npm run build       # tsc --build de todos los paquetes (project references)
npm run typecheck   # build --dry
npm test            # vitest run (unit tests puros de los .logic)

npm run release:check   # build + tests, antes de publicar
npm run publish:dry     # ensayo de publicación (sin subir nada)
npm run publish:all     # publica los 3 paquetes privados
```

## Publicación

Los paquetes `@agent-core/*` (`contracts`, `core`, `agents`, `store-prisma`, `ai-openai`, `notify-telegram`) se
publican como **privados** (`publishConfig.access: restricted`, `0.1.0`, solo `dist/`
+ README); las apps y la raíz quedan `private`. Detalles, orden y registry (npmjs /
GitHub Packages) en [`PUBLISHING.md`](./PUBLISHING.md).
