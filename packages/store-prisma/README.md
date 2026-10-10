# @agent-core/store-prisma

Adapter de persistencia del `CoreStore` del Core sobre **Postgres** vía **Prisma**.
Mismo contrato que el store in-memory de los adapters de referencia — pasa los mismos
tests de comportamiento (persistencia, lectura, aislamiento por tenant, upsert de
config, totales de gasto).

```bash
npm install @agent-core/store-prisma @agent-core/contracts @prisma/client
npm install -D prisma
```

`@prisma/client` es **peer**: este paquete no lo importa (usa una interfaz estructural
`PrismaLike`), así compila y testea sin generar el cliente ni una DB. Vos le pasás tu
`PrismaClient` real, que satisface `PrismaLike`.

## Uso

```ts
import { PrismaClient } from "@prisma/client";
import { crearCoreStorePrisma } from "@agent-core/store-prisma";
import { runSeleccion } from "@agent-core/core";
import { catalogo } from "@agent-core/agents";

const prisma = new PrismaClient();
const store = crearCoreStorePrisma(prisma); // CoreStore respaldado por Postgres

await runSeleccion({ catalogo, ctx, providers, store, modeloNegocio });
```

## Migraciones

El modelo vive en [`prisma/schema.prisma`](./prisma/schema.prisma). Copialo (o apuntá
tu `prisma` a él) y:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db"
npx prisma migrate dev     # crea y aplica la migración
npx prisma generate        # genera el cliente
```

## Diseño

Cada tabla tiene **columnas indexadas** para consultar/aislar (`tenantId`, más las
claves de cada tipo) + una columna **`data` (JSON)** con el objeto canónico completo.
El esquema no cambia cuando crecen los tipos del Core, y **toda query filtra por
`tenantId`** (primera barrera de aislamiento). Las sumas de gasto se hacen sobre las
filas del tenant.

> Nota: el test de este paquete usa un fake in-memory de `PrismaLike` (valida el mapeo
> y el aislamiento, sin DB). El test de integración contra un Postgres real
> (servicio en CI) es un paso aparte.
