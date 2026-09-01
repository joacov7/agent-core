# @agent-core/contracts

Tipos canónicos + interfaces de providers + el tipo `AgentManifest` de la plataforma
**agent-core**. Sin lógica: solo tipos. Lo importan `@agent-core/core`,
`@agent-core/agents` y las apps (para tipar sus adapters).

Paquete **privado** (`publishConfig.access: restricted`).

```bash
npm install @agent-core/contracts
```

```ts
import type { Agent, TenantCtx, ProviderRegistry } from "@agent-core/contracts";
```

Ver el README del monorepo para la arquitectura completa.
