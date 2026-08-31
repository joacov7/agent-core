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
  ejemplo/       @agent-core/app-ejemplo   adapter de referencia in-memory (retail) + smoke e2e
  juridico/      @agent-core/app-juridico  segundo adapter (estudio jurídico, cadencia proyecto)
```

> **Prueba de reutilización:** `apps/juridico` implementa los mismos contratos con
> datos legales (comitente→Contacto, honorario→Cobro, audiencia→Evento,
> escrito→Documento, consulta→Oportunidad) y cadencia `proyecto`. El **mismo
> catálogo** activa Cobros/Morosidad/Agenda/Seguimiento/WhatsApp/… y **desactiva
> solo** Rentabilidad/Precios/Inventario/CRM/Churn — sin tocar una línea de agente.

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
- ✅ `@agent-core/agents`: catálogo con 25 agentes, **todos con `run()` funcional**.
  - dirección: `ceo`, `jefe` (Jefe de Gabinete), `analista` — leen las
    recomendaciones ya generadas (vía `CoreStore`) y las resumen/priorizan.
  - clientes: `crm`, `oportunidades`, `seguimiento` (pipeline), `riesgo_abandono`
    (churn), `postventa` (recompra/reseña), más `whatsapp` (comunicación).
  - comercial: `competencia`, `precios` (competition + catalog; `precios` es
    accionable vía `aplicar_precio`, interceptado por el enforcement), `ventas` (pipeline),
    `prospeccion` (fuentes externas: prioriza prospectos por encaje y descarta los
    que ya están en la base).
  - finanzas: `cobros` (vencido), `morosidad` (mora avanzada), `cobranza_preventiva`
    (por vencer, antes de la mora) — los tres sobre receivables —, `flujo_caja`
    (receivables + suppliers opc.), `rentabilidad`.
  - operaciones: `inventario` (inventory), `compras` (suppliers + inventory),
    `logistica` (logistics), `produccion` (production).
  - organización: `agenda` (agenda), `compliance` (agenda + documents: obligaciones
    regulatorias por vencer sin documento de respaldo), `tareas`.
  Cada uno = `.logic` pura con tests + wrapper `Agent` con manifest completo
  (capacidades + cadencia). Catálogo base completo: `prospeccion` sumó la capacidad
  `external-sources` (prospectos/señales externas); `cobranza_preventiva` y
  `compliance` amplían finanzas y organización reutilizando capacidades ya modeladas.
- ✅ Activación por manifest en el core (`esActivable`/`manifestsActivables`):
  capacidades ⊇ requeridas + modelo de negocio compatible.
- ✅ `@agent-core/app-ejemplo`: adapter de referencia in-memory (providers con
  datos sembrados + `CoreStore` con aislamiento por tenant + tools de escritura +
  mock de IA) y un **smoke test end-to-end** del bucle completo. `npm run build`
  y luego `node apps/ejemplo/dist/demo.js` corre el catálogo y loguea las recos.

**279 tests verdes** (vitest): paridad de los `.logic` + engine (activación,
enforcement, ejecución, memoria, impacto) + AI gateway (presupuesto/atribución) +
los 25 agentes del catálogo + smoke end-to-end de **dos** adapters (retail y jurídico).

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
