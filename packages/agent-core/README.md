# @agent-core/core

El motor de la plataforma **agent-core**: engine (activación por manifest,
enforcement, ejecución, memoria, impacto), recommendations, policies,
jefe-gabinete, resultados, memoria y el AI Gateway (presupuesto + atribución).

Recibe providers y un `CoreStore` por inversión de dependencia; no conoce el
dominio ni la base de datos. Paquete **privado** (`publishConfig.access: restricted`).

```bash
npm install @agent-core/core @agent-core/contracts
```

```ts
import { runAgent, manifestsActivables, capacidadesDeProviders } from "@agent-core/core";
```

Ver el README del monorepo para la arquitectura completa.
