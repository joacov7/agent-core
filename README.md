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
  - Pendiente en el engine: AI gateway con presupuesto/atribución y persistencia
    de Impacto (falta su store en el contrato).
- ✅ `@agent-core/agents`: catálogo con 5 agentes. Los `.logic` de
  crm/oportunidades/whatsapp/rentabilidad portados con sus tests, envueltos en el
  contrato `Agent` con manifests completos (capacidades + cadencia). `whatsapp`
  tiene `run()` funcional (lee `interactions`, clasifica, prioriza con el core);
  crm/oportunidades/rentabilidad tienen la lógica lista y el `run()` pendiente de
  una capa de agregación en los providers.
- ✅ Activación por manifest en el core (`esActivable`/`manifestsActivables`):
  capacidades ⊇ requeridas + modelo de negocio compatible.

**121 tests verdes** (vitest): paridad de los `.logic` + engine (activación,
enforcement, ejecución, memoria).

## Principios

- **Multi-tenancy obligatorio:** todo pasa por `TenantCtx`. Sin tenant, el Core no
  ejecuta (falla cerrado).
- **Inversión de dependencia:** el Core recibe providers y un `CoreStore`; no importa
  Prisma ni servicios del dominio.
- **Auto-descubrible:** las capacidades disponibles se derivan de qué providers existen.
- **Contracts sin lógica:** solo tipos; cambia poco y lo importan todos.

## Scripts

```bash
npm install
npm run build       # tsc --build de todos los paquetes (project references)
npm run typecheck   # build --dry
npm test            # vitest run (unit tests puros de los .logic)
```
