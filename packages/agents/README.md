# @agent-core/agents

Catálogo de agentes reutilizables de la plataforma **agent-core** (28 agentes:
finanzas, clientes, comercial, operaciones, organización, comunicación y dirección).
Cada agente = lógica pura determinística + un wrapper `Agent` con manifest completo.
Usan solo `@agent-core/contracts` y `@agent-core/core`; no conocen el dominio.

El engine los activa según las capacidades que la app expone y su modelo de negocio.
Paquete **privado** (`publishConfig.access: restricted`).

```bash
npm install @agent-core/agents @agent-core/core @agent-core/contracts
```

```ts
import { catalogo } from "@agent-core/agents";
```

Ver el README del monorepo para la arquitectura completa.
