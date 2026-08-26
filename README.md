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
  contracts/     @agent-core/contracts  tipos canónicos + interfaces de providers + Manifest (sin lógica)
  agent-core/    @agent-core/core       engine, recommendations, policies, jefe-gabinete, resultados, memoria, ai-gateway
  agents/        @agent-core/agents     catálogo de agentes reutilizables (usan solo contracts + core)
```

Las **apps** (Regionales, jurídico, contable, …) viven fuera: aportan adapters
(dominio → canónico), domain tools, auth, resolución de tenant, schema y UI.

```
apps/
  ejemplo/       @agent-core/app-ejemplo  adapter de referencia in-memory + smoke e2e
```

## Estado

- ✅ Scaffold del monorepo + `@agent-core/contracts` completo.
- ✅ `@agent-core/core`: `.logic` puros de Regionales portados casi tal cual
  (recommendations, policies, jefe-gabinete, resultados, memoria) como red de
  paridad. **Engine funcional**:
  - `runAgent`: falla cerrado sin `TenantCtx`, activa por manifest (capacidades
    derivadas de los providers + modelo de negocio) y persiste las recomendaciones.
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
- ✅ `@agent-core/agents`: catálogo con 14 agentes, **todos con `run()` funcional**.
  - clientes: `crm`, `oportunidades`, `seguimiento` (pipeline), `riesgo_abandono`
    (churn), más `whatsapp` (comunicación).
  - comercial: `competencia`, `precios` (competition + catalog; `precios` es
    accionable vía `aplicar_precio`, interceptado por el enforcement).
  - finanzas: `cobros`, `morosidad` (receivables), `flujo_caja` (receivables +
    suppliers opc.), `rentabilidad`.
  - organización/operaciones: `agenda` (agenda), `inventario` (inventory), `tareas`.
  Cada uno = `.logic` pura con tests + wrapper `Agent` con manifest completo
  (capacidades + cadencia).
- ✅ Activación por manifest en el core (`esActivable`/`manifestsActivables`):
  capacidades ⊇ requeridas + modelo de negocio compatible.
- ✅ `@agent-core/app-ejemplo`: adapter de referencia in-memory (providers con
  datos sembrados + `CoreStore` con aislamiento por tenant + tools de escritura +
  mock de IA) y un **smoke test end-to-end** del bucle completo. `npm run build`
  y luego `node apps/ejemplo/dist/demo.js` corre el catálogo y loguea las recos.

**205 tests verdes** (vitest): paridad de los `.logic` + engine (activación,
enforcement, ejecución, memoria, impacto) + AI gateway (presupuesto/atribución) +
los 14 agentes del catálogo + smoke end-to-end del adapter de referencia.

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
```
