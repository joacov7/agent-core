# @agent-core/app-wisp

Adapter de un **WISP** (proveedor de internet inalámbrico): lee la base de **guaynet**
(Postgres) y la traduce al modelo canónico para que el catálogo de agentes corra sobre tus
datos reales. **Solo lectura**: los agentes recomiendan, nunca tocan guaynet (ni cortan
servicios ni modifican abonos). Cadencia: `suscripcion`.

## Qué versión de guaynet
Los tests corren contra el **esquema real** de guaynet: el volcado de aplicar sus **43 migraciones** de Alembic
(`rama claude/wisp-management-system-TTAsI`, la que incluye Seguridad, Soporte, Órdenes de trabajo, Inventario, etc.). La rama `main`
de guaynet está desactualizada (1 migración): **no es la que corre en producción**. Este adapter solo usa las tablas del
**servicio de internet** (`clients`, `invoices`, `payments`, `mikrotik_routers`, `ubiquiti_devices`). El módulo **Seguridad**
(`sec_*`) tiene su propio adapter (`crearProvidersSeguridad`, ver "Línea Seguridad" más abajo).

## Qué mapea

| guaynet | Canónico | Agentes que habilita |
|---|---|---|
| `clients` (activo / suspendido; la baja se excluye) | `contacts` | CRM, riesgo de abandono |
| `invoices` + `payments` | `receivables` (saldo = factura − pagado) | Cobros, morosidad, cobranza preventiva, flujo de caja |
| facturas pagadas | `transactions` (la "compra" del abono) | CRM, riesgo de abandono, analista |
| `mikrotik_routers` / `ubiquiti_devices` caídos | `incidents` (con los abonados reales afectados) | Sistemas |

No expone `catalog` (los planes no alimentan a ningún agente y activaría Rentabilidad sin datos
de costo) ni lo que guaynet no tiene (agenda, personal, NPS, inventario): esos agentes quedan
apagados solos. Con tu base: **15 de 30 agentes disponibles** (incluido el Asistente personal).

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

## Línea Seguridad (módulo `sec_*` de guaynet)
Internet y seguridad son **dos líneas de negocio distintas**, y se modelan como **dos tenants**: cada una con su adapter, su
configuración de agentes y su bandeja (así cobros y morosidad quedan solo en internet).
`crearProvidersSeguridad({ db, tenantId })` lee el módulo de alarmas y expone:

| guaynet | Canónico | Agentes |
|---|---|---|
| `sec_alerts` abiertas (pánico, coacción, intrusión, conexión perdida…) | `incidents` (estado nuevo / reconocido) | **Guardia**, Sistemas |
| `sec_events`: batería baja, corte de energía, panel sin comunicación o sabotaje **sin su "restaurado"** (último mes) | `incidents` (falla abierta) | Guardia, Sistemas |
| contratos (`contract_end`), garantías de equipos y certificados por vencer | `agenda` | Agenda |

- **No expone cobros ni clientes:** la seguridad **todavía no se factura** en guaynet (las facturas son solo de internet), así que
  no hay nada que cobrar ni vigilar. Cuando empiece a facturarse, hay que sumar eso.
- **La Guardia es la clave:** el triage común ordena por impacto y un pánico solo llega a ~65/100 (la crítica empieza en 70);
  la Guardia mira el **tiempo**: pánico/coacción/intrusión sin que nadie lo tome en **5 min** es crítico (error: 30 min, warning: 4 h),
  y "en atención" demasiado tiempo (30 min / 2 h) es importante.
- **Privacidad por diseño:** los títulos son neutros ("Pánico: sin atender hace 10 min"); el nombre de la propiedad viaja solo en
  `metadata.titular`. Con permisos **por columna** el rol de Postgres **no puede leer** PINs, palabras seguras, tokens de la app o del
  portal, vínculos de Telegram, mensajes crudos de la central, domicilios ni coordenadas (probado contra el esquema real).
- **Fechas de día completo** (contratos, garantías): valen hasta el **final del día** en Argentina. Con la fecha a las 00:00 UTC, el
  agente de Agenda marcaría "vencido" un contrato durante su propio día de vencimiento.
- Las suscripciones canceladas o pendientes de instalación no generan avisos.

**Permisos:** corré también [`sql/solo-lectura-seguridad.sql`](./sql/solo-lectura-seguridad.sql) (después de `solo-lectura.sql`).

**Ojo, a calibrar:** el agente de Agenda avisa a **7 días** (importante a 2), pensado para turnos y audiencias. Para renovar un
contrato es poco aviso: se puede ampliar (es un ajuste del agente).

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
- `src/seguridad.unit.test.ts` y `src/seguridad.pg.test.ts`: lo mismo para la línea Seguridad (incluye que el rol no pueda leer nada sensible).
- `src/wisp.pg.test.ts`: **contra Postgres real** con el **esquema real** de guaynet (`test/guaynet-schema.sql`,
  volcado de sus 43 migraciones): consultas, el rol de solo lectura con el SQL de arriba **tal cual**
  (no puede escribir ni leer `users`/claves) y los agentes reales sobre los datos. Se activa con
  `WISP_TEST_DATABASE_URL=postgresql://usuario:clave@host:5432/postgres` (necesita poder crear bases y
  roles); en CI corre contra un servicio Postgres. Si guaynet migra su esquema, se regenera `test/guaynet-schema.sql`
  (instrucciones en su encabezado).
