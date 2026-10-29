# @agent-core/app-wisp

Adapter de un **WISP** (proveedor de internet inalámbrico): lee la base de **guaynet**
(Postgres) y la traduce al modelo canónico para que el catálogo de agentes corra sobre tus
datos reales. **Solo lectura**: los agentes recomiendan, nunca tocan guaynet (ni cortan
servicios ni modifican abonos). Cadencia: `suscripcion`.

## Qué versión de guaynet
Los tests corren contra el **esquema real** de guaynet: el volcado de aplicar sus **43 migraciones** de Alembic
(`rama claude/wisp-management-system-TTAsI`, la que incluye Seguridad, Soporte, Órdenes de trabajo, Inventario, etc.). La rama `main`
de guaynet está desactualizada (1 migración): **no es la que corre en producción**. Este adapter solo usa las tablas del
**servicio de internet** (`clients`, `invoices`, `payments`, `mikrotik_routers`, `ubiquiti_devices`); el módulo **Seguridad**
(`sec_*`) todavía no está conectado (ver más abajo).

## Qué mapea

| guaynet | Canónico | Agentes que habilita |
|---|---|---|
| `clients` (activo / suspendido; la baja se excluye) | `contacts` | CRM, riesgo de abandono |
| `invoices` + `payments` | `receivables` (saldo = factura − pagado) | Cobros, morosidad, cobranza preventiva, flujo de caja |
| facturas pagadas | `transactions` (la "compra" del abono) | CRM, riesgo de abandono, analista |
| `mikrotik_routers` / `ubiquiti_devices` caídos | `incidents` (con los abonados reales afectados) | Sistemas |

No expone `catalog` (los planes no alimentan a ningún agente y activaría Rentabilidad sin datos
de costo) ni lo que guaynet no tiene (agenda, personal, NPS, inventario): esos agentes quedan
apagados solos. Con tu base: **14 de 29 agentes disponibles** (incluido el Asistente personal).

Detalles que importan:
- **Vencido** = factura marcada `overdue` **o** con la fecha pasada aunque guaynet todavía no la
  haya marcado (su tarea de Celery corre una vez por día).
- **Pago parcial**: el monto a cobrar es el saldo, no la factura entera.
- **"Hoy"** se calcula en la zona del negocio (`America/Argentina/Buenos_Aires`): a las 22 h ya
  es "mañana" en UTC y los vencimientos saltarían un día antes.
- **Un WISP = un tenant** (`WISP_TENANT`, default `guaynet`). Cualquier otro tenant ve vacío.
- **Datos personales**: viajan solo nombre, teléfono y email. No se leen DNI, CUIT, domicilio,
  IP ni MAC, ni la tabla `users`, ni las claves de los equipos.

## Conectarlo (paso a paso)

**1. Crear el usuario de solo lectura** en la base de guaynet (es inofensivo, solo concede lectura).
Editá la contraseña de [`sql/solo-lectura.sql`](./sql/solo-lectura.sql) y corré:

```bash
cd /ruta/a/guaynet
docker compose exec db psql -U guaynet -d guaynet     # y pegá el contenido del .sql
```

El rol ve solo las columnas que necesita: **no** `users` (hashes de contraseña) ni las claves de
los MikroTik/Ubiquiti. Además toda sesión suya es de solo lectura (`default_transaction_read_only`).

**2. Apuntar la app web a esa base** (`apps/web/.env`):

```bash
WISP_DATABASE_URL=postgresql://agentcore_ro:TU_CLAVE@127.0.0.1:5432/guaynet
```

El `docker-compose` de guaynet publica Postgres en el puerto 5432 del host, así que
`127.0.0.1:5432` funciona desde la misma máquina. La home muestra "● Datos reales del WISP" cuando
está conectada.

**3. Levantar y probar**: encendé agentes en `/consola`, **Correr equipo**, y mirá `/bandeja`
(cada hallazgo dice a qué abonado se refiere).

## Qué esperar (y qué ajustar con datos reales)
- **Riesgo de abandono** compara los días desde el último pago con tu frecuencia habitual
  (≈30 días). Un abonado que paga tarde en el ciclo puede salir como "en riesgo" (severidad más
  baja, *oportunidad*). Si ves demasiado ruido, es un umbral a calibrar con tus datos: avisame.
- **Equipos caídos** dependen de que guaynet actualice `status`/`last_seen` de sus equipos; si
  están en `unknown`, no hay incidentes.
- La configuración de los agentes y las recomendaciones se guardan **en memoria**: se pierden al
  reiniciar la app web. Persistirlas es el siguiente paso.
- Si la base no responde durante una corrida, **toda** la corrida falla (el motor no aísla por
  agente todavía) y `/api/run` responde 502 sin filtrar detalles.

## Tests
- `src/wisp.unit.test.ts`: mapeo, paginación, guardas de solo lectura y aislamiento de tenant (sin DB).
- `src/wisp.pg.test.ts`: **contra Postgres real** con el **esquema real** de guaynet (`test/guaynet-schema.sql`,
  volcado de sus 43 migraciones): consultas, el rol de solo lectura con el SQL de arriba **tal cual**
  (no puede escribir ni leer `users`/claves) y los agentes reales sobre los datos. Se activa con
  `WISP_TEST_DATABASE_URL=postgresql://usuario:clave@host:5432/postgres` (necesita poder crear bases y
  roles); en CI corre contra un servicio Postgres. Si guaynet migra su esquema, se regenera `test/guaynet-schema.sql`
  (instrucciones en su encabezado).
