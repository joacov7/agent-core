# Instructivo de instalación y configuración (Ubuntu, red local)

Guía completa para poner `agent-core` a trabajar sobre **guaynet** (WISP + alarmas) en un servidor Ubuntu propio:
instalación, servicio permanente, conexión a la base en solo lectura, IA local gratis, avisos por Telegram, seguridad de
acceso, backups, actualización y resolución de problemas.

> **Convenciones de este documento**
> - Rutas de ejemplo: el usuario es `joaquin`, el servidor `10.0.0.39`, los repos están en `~/agent-core` y `~/guaynet`.
>   Cambialas por las tuyas.
> - Los bloques con `$` o sin prompt se corren **en el servidor**, salvo que diga "en tu PC".
> - **Nunca pegues claves, tokens ni contraseñas** en chats, issues o commits. Los repos de este proyecto son **públicos**.
> - Lo marcado **(no probado)** es un ejemplo estándar que no se ejecutó en el servidor real; probalo antes de depender de él.

---

## Índice
1. [Qué se instala y cómo encaja](#1-qué-se-instala-y-cómo-encaja)
2. [Requisitos](#2-requisitos)
3. [Orden recomendado (fases)](#3-orden-recomendado-fases)
4. [Fase 1 — Instalar y probar en modo demo](#4-fase-1--instalar-y-probar-en-modo-demo)
5. [Fase 2 — Dejarlo como servicio permanente](#5-fase-2--dejarlo-como-servicio-permanente)
6. [Fase 3 — Conectar los datos reales de guaynet](#6-fase-3--conectar-los-datos-reales-de-guaynet)
7. [Fase 4 — Línea Seguridad (alarmas)](#7-fase-4--línea-seguridad-alarmas)
8. [Fase 5 — IA local gratis (Ollama)](#8-fase-5--ia-local-gratis-ollama)
9. [Fase 6 — Avisos por Telegram (Gael)](#9-fase-6--avisos-por-telegram-gael)
10. [Seguridad de acceso (la app no tiene login)](#10-seguridad-de-acceso-la-app-no-tiene-login)
11. [Referencia de variables de entorno](#11-referencia-de-variables-de-entorno)
12. [Archivos que se generan, backups y restauración](#12-archivos-que-se-generan-backups-y-restauración)
13. [Actualizar a una versión nueva](#13-actualizar-a-una-versión-nueva)
14. [Operación diaria](#14-operación-diaria)
15. [Resolución de problemas](#15-resolución-de-problemas)
16. [Endurecimiento de guaynet](#16-endurecimiento-de-guaynet)
17. [Limitaciones conocidas](#17-limitaciones-conocidas)
18. [Checklist final](#18-checklist-final)
19. [Desinstalar o volver atrás](#19-desinstalar-o-volver-atrás)

---

## 1. Qué se instala y cómo encaja

```
                         tu red local (10.0.0.0/24)
 navegador / celular ───────────────┐
                                    ▼
                          ┌───────────────────┐        lee (solo lectura)       ┌─────────────────────┐
                          │  agent-core (web) │ ──────────────────────────────▶ │ Postgres de guaynet │
                          │  Next.js :3100    │   usuario agentcore_ro          │ 127.0.0.1:5432      │
                          └───┬──────────┬────┘                                 └─────────────────────┘
                              │          │ chat (opcional)
                 avisos       │          ▼
                 (solo envía) │   ┌──────────────┐
                              ▼   │ Ollama :11434 │  modelo local, sin salir de la máquina
                       ┌──────────┐ └──────────────┘
                       │ Telegram │
                       └──────────┘
```

- **agent-core** (este repo) es la app web con el equipo de agentes. Corre en el puerto **3100**.
- **guaynet** es tu sistema de administración (otro repo). **agent-core no lo modifica nunca**: solo lee su base de datos con
  un usuario que tiene permisos de lectura por columna.
- **Dos líneas de negocio = dos tenants**: **Internet** (tenant `guaynet`) y **Seguridad** (tenant `guaynet-seguridad`). Cada una
  tiene su propio equipo de agentes, su bandeja, su configuración y sus avisos.
- **Gael** (agente `asistente`) es el único proactivo: manda por Telegram el resumen de la mañana y avisa lo urgente. **Solo avisa**.
- Los agentes **recomiendan**; no cortan servicios, no modifican abonos ni ejecutan acciones sobre guaynet.

### Puertos que se usan
| Puerto | Qué | Quién puede llegar |
|---|---|---|
| **3100** | agent-core (web + API) | tu red local (ver [sección 10](#10-seguridad-de-acceso-la-app-no-tiene-login)) |
| 3000 | otros sistemas tuyos | (no lo toca agent-core) |
| 5432 | Postgres de guaynet | solo el propio servidor (`127.0.0.1`) en el `docker-compose.yml` de guaynet |
| 8000 | backend de guaynet | solo el propio servidor (`127.0.0.1`) en ese compose |
| 11434 | Ollama (IA local) | solo el propio servidor |

---

## 2. Requisitos

| | Mínimo | Notas |
|---|---|---|
| Sistema | Ubuntu con `systemd` | |
| Node.js | **20 o superior** | `node --version`. El repo declara `engines: node >=20`. |
| npm | el que trae Node | `npm --version` |
| git | cualquiera | `git --version` |
| RAM | 4 GB | La app es liviana. El modelo de IA local (`qwen2.5:1.5b`) necesita ~1,5 GB **extra**; sumá lo que ya usan guaynet y tus otros sistemas. Mirá `free -h`. |
| Disco | ~1 GB libre | `node_modules` + build. Ollama suma lo que pese el modelo (~1–2 GB). |
| Docker | el que ya usás para guaynet | solo para correr el SQL dentro del contenedor de la base |
| Red | acceso a `github.com` y `registry.npmjs.org` | para clonar e instalar |
| GPU | no hace falta | |

Comprobación rápida:
```bash
node --version && npm --version && git --version && free -h && df -h ~
```

---

## 3. Orden recomendado (fases)

Hacelo en este orden. **No avances de fase hasta que pase la verificación de la anterior.**

| Fase | Qué | Riesgo | Verificación |
|---|---|---|---|
| 1 | Instalar y probar con datos de ejemplo | ninguno (no toca guaynet) | ves los agentes y la bandeja |
| 2 | Servicio permanente (systemd) | bajo | sobrevive a un reinicio del servidor |
| 3 | Conectar la base real de guaynet (Internet) | bajo (solo lectura) | "Datos reales del WISP" en la home |
| 4 | Línea Seguridad | bajo (solo lectura) | selector Internet/Seguridad |
| 5 | IA local (Ollama) | bajo (consume RAM) | el chat responde |
| 6 | Telegram + Gael | medio (manda mensajes) | llega el mensaje de prueba |

Antes de la fase 3 resolvé la [sección 10](#10-seguridad-de-acceso-la-app-no-tiene-login): con datos reales de clientes, la
app **no debe** quedar abierta a cualquiera de tu red sin pensarlo.

---

## 4. Fase 1 — Instalar y probar en modo demo

### 4.1 Clonar e instalar
El repo es público, no necesitás credenciales.
```bash
cd ~
git clone https://github.com/joacov7/agent-core.git
cd agent-core
npm ci
npm run build
```
- `npm ci` instala exactamente lo del `package-lock.json`. Al final avisa de "vulnerabilidades": son casi todas de herramientas de
  desarrollo. **No corras `npm audit fix --force`** (puede subir versiones mayores y romper el build). Para ver solo las que
  afectan a lo que corre en producción: `npm audit --omit=dev`.
- `npm run build` (raíz) compila los paquetes `@agent-core/*` a `dist/`. **Es obligatorio la primera vez y después de cada
  `git pull`**: la app web importa esos `dist/`.
- Si ya lo tenés clonado: `cd ~/agent-core && git pull origin main && npm ci && npm run build`.

Verificá que estés en la versión esperada:
```bash
git log --oneline -3
```

### 4.2 Configuración inicial
```bash
cd ~/agent-core/apps/web
cp .env.example .env
chmod 600 .env
echo "AI_PROVIDER=off" >> .env      # apaga el chat hasta que instales un modelo (fase 5)
```
Con solo eso la app corre en **modo demo** (datos de ejemplo de un comercio, sin base de datos).

### 4.3 Compilar y arrancar
```bash
cd ~/agent-core/apps/web
npx next build           # tarda un par de minutos
npx next start -p 3100   # puerto 3100 (el 3000 lo usan tus otros sistemas)
```
Tiene que mostrar algo así:
```
▲ Next.js 15.x
- Local:   http://localhost:3100
- Network: http://10.0.0.39:3100
✓ Ready in 451ms
[store] persistente en .agentcore/store.json · 0 agente(s) configurado(s), 0 recomendación(es)
```
`next dev` (modo desarrollo) también existe, pero para el servidor usá `next build` + `next start`.

### 4.4 Abrir el puerto en el firewall (solo para tu red)
Si desde tu PC no carga y el servidor tiene `ufw` activo, el puerto 3100 está bloqueado:
```bash
sudo ufw status
sudo ufw allow from 10.0.0.0/24 to any port 3100 proto tcp
sudo ufw status
```
- `10.0.0.0/24` es el rango de tu red local. Si la IP de tu PC no empieza con `10.0.0.`, cambialo (en Windows: `ipconfig` →
  "Dirección IPv4").
- **No uses `ufw allow 3100`** a secas: lo abriría a cualquier origen.

Probar la conexión desde tu PC (PowerShell):
```powershell
Test-NetConnection 10.0.0.39 -Port 3100
```
Tiene que decir `TcpTestSucceeded : True`. Después abrí `http://10.0.0.39:3100` (con `http`, no `https`).

### 4.5 Qué verificar en la demo
1. **`/`** (Equipo): los agentes con nombre propio y su estado.
2. **`/consola`**: encendé 2 o 3 agentes (por ejemplo Cobros y Morosidad), ajustá la autonomía, ponéles otro nombre (✎) y tocá
   **Correr equipo**.
3. **`/bandeja`**: tienen que aparecer recomendaciones firmadas por cada agente.
4. **Persistencia**: cortá el servidor (Ctrl-C), volvelo a arrancar y entrá a `/consola`. Los agentes encendidos y los alias
   tienen que seguir ahí, y el log debe decir `N agente(s) configurado(s)` con N mayor que 0.

Fase 1 lista. Cortá el servidor con Ctrl-C y pasá a la fase 2.

---

## 5. Fase 2 — Dejarlo como servicio permanente

Para que arranque solo con el servidor y se reinicie si se cae.

### 5.1 Averiguar las rutas de Node
```bash
command -v node npm npx
ls ~/agent-core/node_modules/.bin/next
```
Si Node viene de `nvm` (la ruta contiene `.nvm`), `systemd` **no** lo ve por defecto: en la unidad tenés que agregar esa carpeta al
`PATH` (abajo).

### 5.2 Crear la unidad de systemd
Archivo `/etc/systemd/system/agent-core.service` (con `sudo`):
```ini
[Unit]
Description=agent-core (equipo de agentes IA)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=joaquin
# IMPORTANTE: el directorio de trabajo define dónde se guarda .agentcore/ (store.json y estado-avisos.json)
WorkingDirectory=/home/joaquin/agent-core/apps/web
Environment=NODE_ENV=production
# Solo si Node viene de nvm: ajustá a tu versión
# Environment=PATH=/home/joaquin/.nvm/versions/node/vXX.X.X/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/joaquin/agent-core/node_modules/.bin/next start -p 3100
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```
- Next lee solo el `.env` de `apps/web`: no hace falta `EnvironmentFile`.
- Para que **solo** el propio servidor pueda llegar (y entrar por túnel SSH, ver sección 10), agregá `-H 127.0.0.1` al
  `ExecStart`.

### 5.3 Activarlo
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agent-core
sudo systemctl status agent-core --no-pager
journalctl -u agent-core -n 30 --no-pager
```
Tiene que verse `active (running)` y la línea `[store] persistente…`.

### 5.4 Verificar
```bash
curl -sI http://127.0.0.1:3100 | head -3          # HTTP/1.1 200 OK
sudo reboot                                        # (en un momento oportuno)
# después del reinicio:
systemctl is-active agent-core                     # active
```
Los agentes que encendiste en la demo tienen que seguir encendidos tras el reinicio.

---

## 6. Fase 3 — Conectar los datos reales de guaynet

### 6.0 Antes de empezar
1. **Decidí el acceso** (sección 10): con datos reales, que no entre cualquiera de tu red.
2. **Hacé un respaldo de la base de guaynet** (siempre, aunque esto solo lee):
   ```bash
   cd ~/guaynet
   docker compose exec -T db pg_dump -U guaynet guaynet > ~/backup-guaynet-$(date +%F).sql
   ls -lh ~/backup-guaynet-*.sql          # no puede pesar 0 bytes
   chmod 600 ~/backup-guaynet-*.sql
   ```
   Ese archivo tiene datos de clientes: guardalo fuera de cualquier repo.
3. Confirmá que estás usando la rama correcta de guaynet (la que corre en producción tiene el módulo Seguridad y 43 migraciones):
   ```bash
   cd ~/guaynet && git branch --show-current
   ```
   Se espera `claude/wisp-management-system-TTAsI`. La rama `main` de guaynet está desactualizada.

### 6.1 Crear el usuario de solo lectura
El script [`apps/wisp/sql/solo-lectura.sql`](../apps/wisp/sql/solo-lectura.sql) crea el rol `agentcore_ro`:
- Lee solo las columnas necesarias: `clients`, `plans`, `invoices`, `payments`, y de `mikrotik_routers` / `ubiquiti_devices`
  únicamente id, nombre, ubicación, estado y última conexión.
- **No** puede leer `users` (hashes de contraseña) ni las claves de los equipos.
- Toda sesión suya es de solo lectura (`default_transaction_read_only = on`).

Generá una contraseña **sin caracteres especiales** (así no hay que codificarla en la URL), anotala y creá el rol:
```bash
CLAVE=$(openssl rand -hex 24)
echo "Anotá esta clave (la vas a poner en WISP_DATABASE_URL): $CLAVE"

sed "s/<elegí una contraseña larga>/$CLAVE/" ~/agent-core/apps/wisp/sql/solo-lectura.sql \
  | (cd ~/guaynet && docker compose exec -T db psql -v ON_ERROR_STOP=1 -U guaynet -d guaynet)
```
Salida esperada: `CREATE ROLE`, `GRANT` (varias) y `ALTER ROLE`.
- Si dice `role "agentcore_ro" already exists`, el rol ya estaba. Para cambiar su clave:
  `docker compose exec db psql -U guaynet -d guaynet -c "ALTER ROLE agentcore_ro PASSWORD 'NUEVA'"`.
- La clave queda en el historial de la terminal. Si te importa: `history -d <n>` o cerrá la sesión y borrá el historial.

### 6.2 Verificar el rol (opcional pero recomendado)
```bash
cd ~/guaynet
docker compose exec db psql -U agentcore_ro -d guaynet -c "select count(*) from clients;"     # funciona
docker compose exec db psql -U agentcore_ro -d guaynet -c "select * from users limit 1;"      # tiene que dar: permission denied
docker compose exec db psql -U agentcore_ro -d guaynet -c "delete from clients;"               # tiene que dar: permission denied / read-only
```
Si el segundo y el tercero **no** dan error, no sigas y revisá que el script se haya ejecutado completo.

### 6.3 Apuntar la app a la base
Editá `~/agent-core/apps/web/.env`:
```bash
WISP_DATABASE_URL=postgresql://agentcore_ro:LA_CLAVE_QUE_ANOTASTE@127.0.0.1:5432/guaynet
WISP_TENANT=guaynet
```
- `127.0.0.1:5432` funciona porque el compose de guaynet publica Postgres en el puerto 5432 **del host** (solo en loopback).
- Si la clave tuviera caracteres especiales (`@`, `/`, `:`, `#`, `%`), hay que codificarlos en la URL. Con `openssl rand -hex`
  no hace falta.
- **No cambies `WISP_TENANT` después de empezar a usar la app**: la configuración y la bandeja guardadas están asociadas al
  nombre del tenant, y cambiarlo las deja huérfanas.

Reiniciá: `sudo systemctl restart agent-core`.

### 6.4 Verificar
1. La home muestra **"● Datos reales del WISP"**.
2. En `/consola`, encendé agentes (ahora con tus datos) y tocá **Correr equipo**.
3. En `/bandeja`, cada hallazgo indica a qué abonado se refiere.
4. Mirá el log: `journalctl -u agent-core -n 50 --no-pager`. No debe haber `permission denied`.

Con tu base, en la línea Internet quedan **15 de 30 agentes disponibles**: los demás necesitan datos que guaynet no tiene (agenda,
personal, NPS, inventario…) y se apagan solos.

### 6.5 Qué datos se leen
| guaynet | Canónico | Agentes que habilita |
|---|---|---|
| `clients` (activo / suspendido; la baja se excluye) | contactos | CRM, riesgo de abandono |
| `invoices` + `payments` | cuentas a cobrar (saldo = factura − pagado) | Cobros, morosidad, cobranza preventiva, flujo de caja |
| facturas pagadas | transacciones | CRM, riesgo de abandono, analista |
| `mikrotik_routers` / `ubiquiti_devices` caídos | incidentes (con los abonados afectados) | Sistemas |

Solo viajan nombre, teléfono y email de los clientes. **No** se leen DNI, CUIT, domicilio, IP, MAC, la tabla `users` ni las claves
de los equipos. Detalles y mapeo completo: [`apps/wisp/README.md`](../apps/wisp/README.md).

---

## 7. Fase 4 — Línea Seguridad (alarmas)

Internet y Seguridad son dos líneas separadas. En guaynet la seguridad **todavía no se factura**, por eso en esa línea no hay
agentes de cobro.

### 7.1 Permisos de lectura del módulo `sec_*`
Después de `solo-lectura.sql` (que crea el rol), corré [`apps/wisp/sql/solo-lectura-seguridad.sql`](../apps/wisp/sql/solo-lectura-seguridad.sql):
```bash
cat ~/agent-core/apps/wisp/sql/solo-lectura-seguridad.sql \
  | (cd ~/guaynet && docker compose exec -T db psql -v ON_ERROR_STOP=1 -U guaynet -d guaynet)
```
Salida esperada: varios `GRANT`. Si da error de columna o tabla inexistente, tu guaynet no está en la versión esperada (43
migraciones): **no sigas** y avisá el mensaje exacto.

El script concede permisos **por columna**, solo lo que los agentes necesitan. El rol **no puede leer**: PINs, palabras seguras,
tokens de la app o del portal, vínculos de Telegram, mensajes crudos de la central, domicilios ni coordenadas.

### 7.2 Activar la línea
En `~/agent-core/apps/web/.env`:
```bash
SEGURIDAD=on
# SEGURIDAD_TENANT=guaynet-seguridad     # opcional; tiene que ser distinto del tenant de internet
SEGURIDAD_AVISO_DIAS=30                  # avisar contratos/garantías/certificados 30 días antes
SEGURIDAD_URGENTE_DIAS=15                # y marcarlos "importantes" a los 15
```
`sudo systemctl restart agent-core`. Si `SEGURIDAD_TENANT` fuera igual al tenant de internet, la app **se niega a arrancar** (cada
línea necesita el suyo).

### 7.3 Verificar
1. Arriba aparece el **selector Internet / Seguridad** (la elección se guarda en una cookie `linea`).
2. En la línea **Seguridad** hay 7 agentes disponibles: **guardia**, agenda, sistemas, tareas, dirección, asistente.
3. Encendé **Valen (Guardia)** y **Agenda**, y corré el equipo.

### 7.4 Qué hace cada cosa en Seguridad
- **Guardia (Valen)** mira el **tiempo**: pánico, coacción o intrusión sin que nadie lo tome en **5 min** es crítico; una alerta
  "en atención" demasiado tiempo (30 min / 2 h) es importante. Lee también fallas abiertas del último mes (batería baja, corte de
  energía, panel sin comunicación, sabotaje) que no tengan su "restaurado".
- **Agenda** avisa contratos, garantías de equipos y certificados por vencer. Por defecto el agente avisa a 7 días (importante a 2);
  en Seguridad se amplió a **30 y 15** porque renovar un contrato necesita más anticipación. Se ajusta con las dos variables de arriba.
- **Privacidad:** los títulos son neutros ("Pánico: sin atender hace 10 min"). El nombre de la propiedad aparece en la bandeja de
  la app pero **no** en Telegram (salvo `AVISOS_NOMBRES=on`).
- Las suscripciones canceladas o pendientes de instalación no generan avisos.
- Las fechas de día completo valen hasta el final del día en Argentina (no marca "vencido" un contrato durante su propio día).

---

## 8. Fase 5 — IA local gratis (Ollama)

El chat (`/agentes/<id>`) usa un modelo por una API compatible con OpenAI. Por defecto es **Ollama local**: gratis, sin claves y los
datos no salen de tu máquina. **Sin modelo, todo lo demás funciona igual**; solo el chat avisa que no puede conectar.

### 8.1 Instalar Ollama y un modelo
```bash
curl -fsSL https://ollama.com/install.sh | sh        # instala el servicio (puerto 11434)
ollama pull qwen2.5:1.5b                              # ~1,5 GB de RAM, anda sin GPU
```
El instalador se ejecuta como administrador: es el método oficial, pero leé el script si te preocupa
(`curl -fsSL https://ollama.com/install.sh | less`).

### 8.2 Verificar
```bash
curl -s http://127.0.0.1:11434/api/tags | head -c 300     # lista el modelo
ollama run qwen2.5:1.5b "Decime hola en una frase"        # Ctrl-D para salir
free -h                                                    # mirá cuánta RAM libre queda
```

### 8.3 Configurar la app
Quitá la línea `AI_PROVIDER=off` que agregaste en la fase 1 y dejá (o agregá) en `apps/web/.env`:
```bash
AI_PROVIDER=openai-compat
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=qwen2.5:1.5b
```
`sudo systemctl restart agent-core` y probá el chat en `/agentes/<id>`. En una CPU sin GPU la primera respuesta puede demorar:
si se corta por tiempo devuelve `504`.

### 8.4 Qué modelo según el equipo
| Equipo | Modelo sugerido |
|---|---|
| 4 GB de RAM, sin GPU | `qwen2.5:1.5b` (o `gemma2:2b`) |
| 8 GB | `llama3.2:3b` |
| con GPU / 16 GB+ | `qwen2.5:7b` o más |

Un modelo chico alcanza para explicar hallazgos y redactar respuestas cortas; **no** para analizar un mercado ni razonar sobre
cifras. El chat responde en la voz del agente y **solo con lo que ese agente encontró**; no puede ejecutar acciones.

### 8.5 Usar una API paga (opcional)
```bash
AI_BASE_URL=https://api.openai.com/v1      # o cualquier API compatible con OpenAI
AI_MODEL=<modelo>
AI_API_KEY=<tu clave>
AI_COST_IN_1K=<costo por 1000 tokens de entrada>
AI_COST_OUT_1K=<costo por 1000 tokens de salida>
AI_BUDGET_TENANT=5                          # tope de gasto por tenant; sin definir = sin tope
```
El gasto se atribuye por tenant y agente. Al llegar al tope, el chat responde `429`. Con una API paga los datos que ve el modelo
**salen de tu servidor**: tenelo en cuenta si hay datos de clientes. El gasto acumulado se persiste y no se reinicia al reiniciar.

### 8.6 Apagar o probar la interfaz
`AI_PROVIDER=off` apaga el chat. `AI_PROVIDER=mock` da respuestas falsas, útil solo para probar la interfaz.

---

## 9. Fase 6 — Avisos por Telegram (Gael)

**Gael** manda el resumen de la mañana y avisa lo urgente. **Solo envía**: no hay webhook ni comandos entrantes, no abre ningún
puerto y nadie puede darle órdenes al sistema por el chat. Por defecto está **apagado**.

### 9.1 Crear el bot
1. En Telegram hablale a **@BotFather** → `/newbot` → elegí nombre → copiá el **token**.
2. Abrí tu bot nuevo y mandale **/start**. (Un bot no puede escribirle a quien no lo inició.)

### 9.2 Obtener tu chat id
En `~/agent-core/apps/web/.env`:
```bash
TELEGRAM_BOT_TOKEN=<el token de BotFather>
```
Después:
```bash
cd ~/agent-core/apps/web
npm run telegram:chat-id
```
Lista los chats que le escribieron al bot, por ejemplo `123456789   (private: Joaquín)`. Si dice que todavía no hay chats, mandale
/start al bot y repetí.

### 9.3 Configurar los destinos
```bash
TELEGRAM_CHAT_IDS=123456789                 # lista cerrada; varios separados por coma
TELEGRAM_CHAT_IDS_SEGURIDAD=987654321       # opcional: otro chat para la línea Seguridad (p.ej. el equipo de guardia)
```
Si no definís `TELEGRAM_CHAT_IDS_SEGURIDAD`, la línea Seguridad usa `TELEGRAM_CHAT_IDS`. Mismo bot para las dos líneas; los mensajes
llevan la línea en el encabezado ("· 🛡️ Seguridad").

Reiniciá (`sudo systemctl restart agent-core`) y en la home tocá **"Enviar mensaje de prueba"**. Por línea de comandos
**(no probado en tu servidor)**:
```bash
curl -s -X POST http://127.0.0.1:3100/api/asistente/prueba                                        # línea por defecto
curl -s -X POST http://127.0.0.1:3100/api/asistente/prueba -H 'x-tenant-id: guaynet-seguridad'    # línea Seguridad
```
Límite: una prueba cada 30 segundos por línea.

### 9.4 Activar los avisos programados
```bash
SCHEDULER=on
RESUMEN_HORA=08:00
ALERTAS_CADA_MIN=30
ALERTAS_SILENCIO=22:00-08:00
ALERTAS_MAX_DIA=5
AVISOS_ZONA=America/Argentina/Buenos_Aires
PUBLIC_URL=http://10.0.0.39:3100
```
Reiniciá y **encendé a Gael en `/consola`**, en **cada línea** donde lo quieras (más los agentes que querés que te informen). Sin Gael
encendido no manda nada aunque `SCHEDULER=on`.

En el log tiene que aparecer:
```
[avisos] programador activo · líneas: 🌐 Internet (1 chat), 🛡️ Seguridad (1 chat) · resumen 08:00 · alertas cada 30 min (...)
```
Si en cambio dice `SCHEDULER=on pero falta TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_IDS: no se enviará nada.`, falta alguno de los dos.

Estado de los avisos (sin token ni chat ids): `curl -s http://127.0.0.1:3100/api/asistente`.

### 9.5 Qué manda y cuándo
| | |
|---|---|
| **Resumen** | Una vez por día a `RESUMEN_HORA`. Críticas, importantes y oportunidades, por agente. Si la app estuvo caída, se manda hasta 2 h tarde; pasado eso se omite (sería un resumen viejo). Si falla el envío, reintenta a los 10 min. |
| **Alertas** | Cada `ALERTAS_CADA_MIN` min revisa y avisa solo lo **crítico y nuevo**, una sola vez. Nunca en la franja `ALERTAS_SILENCIO` y con tope de `ALERTAS_MAX_DIA` por día; lo que quede aparece en el resumen de mañana. `ALERTAS_CADA_MIN=0` deja solo el resumen. |

Todas las líneas comparten el mismo horario, franja de silencio y tope. Un valor inválido no rompe el arranque: usa el default y deja
una advertencia `[avisos] …` en el log.

### 9.6 Garantías y privacidad
- Manda **solo** a los chats de la lista cerrada. El token nunca aparece en logs, errores ni respuestas de la API.
- Por defecto los mensajes **no llevan nombres de clientes** (solo tipos y montos): Telegram no cifra de extremo a extremo en
  chats normales. `AVISOS_NOMBRES=on` los incluye.
- Si Telegram o la base fallan, el aviso **no se da por enviado** y se reintenta; el error queda en el log.
- El estado (qué se avisó) se guarda en `.agentcore/estado-avisos.json` (permisos 600): **reiniciar no reenvía** el resumen de hoy
  ni repite alertas.
- **Si el token se filtra:** en @BotFather, `/revoke`, y poné el nuevo token en el `.env`.

---

## 10. Seguridad de acceso (la app no tiene login)

**Hoy la app no tiene autenticación.** Cualquiera que llegue al puerto ve la consola, la bandeja (con nombres de clientes) y puede
encender o apagar agentes y mandar mensajes de prueba por Telegram. Con datos de demo no importa; **con datos reales sí**.

Elegí **una** de estas opciones antes de la fase 3:

### Opción A — Solo tu red local con firewall (lo mínimo)
Es lo que ya configuraste en la fase 1: `ufw allow from 10.0.0.0/24 to any port 3100`. Cualquiera conectado a tu red local ve la
consola. Aceptable solo si esa red es de confianza (no hay WiFi de invitados ni clientes en el mismo segmento).

### Opción B — Solo el propio servidor + túnel SSH (recomendada)
La app escucha únicamente en `127.0.0.1` y vos entrás por un túnel cifrado:
1. En la unidad de systemd, `ExecStart=… next start -p 3100 -H 127.0.0.1`, y recargá.
2. Cerrá el puerto en el firewall: `sudo ufw delete allow from 10.0.0.0/24 to any port 3100 proto tcp` (o borrá esa regla desde
   `sudo ufw status numbered`).
3. En tu PC (PowerShell o terminal):
   ```bash
   ssh -L 3100:127.0.0.1:3100 joaquin@10.0.0.39
   ```
   y abrí `http://localhost:3100`. Mientras el túnel esté abierto, funciona.
- `PUBLIC_URL` (el link a la bandeja en los mensajes de Telegram) apuntaría a una dirección que el celular no puede abrir. Poné
  igual la IP del servidor si estás en la red local, sabiendo que solo abre con el túnel.

### Opción C — Proxy con usuario y contraseña delante **(no probado)**
nginx con autenticación básica, y la app escuchando solo en loopback (`-H 127.0.0.1`). Ejemplo estándar:
```bash
sudo apt install nginx apache2-utils
sudo htpasswd -c /etc/nginx/agentcore.htpasswd joaquin
```
`/etc/nginx/sites-available/agentcore`:
```nginx
server {
    listen 3200;
    location / {
        auth_basic "agent-core";
        auth_basic_user_file /etc/nginx/agentcore.htpasswd;
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
    }
}
```
Habilitalo (`sudo ln -s … /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`) y abrí el 3200 en `ufw` solo para
tu red. Sin HTTPS, la contraseña viaja sin cifrar por la red local.

### Siempre
- **No expongas la app a internet** (ni por port-forwarding del router) mientras no tenga un login real. El camino previsto es
  Clerk (ver `apps/web/README.md`, "Pasar a PRODUCCIÓN").
- Tus repos de GitHub son **públicos**: nunca subas `.env`, `.agentcore/`, ni respaldos `.sql`. `apps/web/.gitignore` ya excluye
  `.env` y `.agentcore/`.

---

## 11. Referencia de variables de entorno

Todas van en `apps/web/.env`. Después de cambiar cualquiera: `sudo systemctl restart agent-core`.

### Datos
| Variable | Default | Qué hace |
|---|---|---|
| `WISP_DATABASE_URL` | (vacía) | URL de Postgres de guaynet con el rol de solo lectura. **Vacía = modo demo** con datos de ejemplo. |
| `WISP_TENANT` | `guaynet` | Nombre del tenant de la línea Internet. **No lo cambies después de usar la app.** |
| `DEV_TENANT` | `demo` | Tenant del modo demo (y, si está definida, pisa a `WISP_TENANT`). |
| `SEGURIDAD` | off | `on`, `1`, `true`, `si` o `sí` activa la línea Seguridad (requiere `WISP_DATABASE_URL`). |
| `SEGURIDAD_TENANT` | `guaynet-seguridad` | Tenant de Seguridad. Tiene que ser distinto del de Internet o la app no arranca. |
| `SEGURIDAD_AVISO_DIAS` | `30` | Días de anticipación para avisar vencimientos en Seguridad (entero 0–365). |
| `SEGURIDAD_URGENTE_DIAS` | `15` | Días desde los que el aviso es "importante" (entero 0–365). El aviso nunca es menor que este. |

### Persistencia
| Variable | Default | Qué hace |
|---|---|---|
| `STORE_ARCHIVO` | `.agentcore/store.json` | Dónde se guardan agentes, alias, bandeja, memoria y gasto de IA. Relativa al directorio de trabajo. |
| `STORE_PERSISTENTE` | `on` | `off`, `0`, `false` o `no` = todo en memoria (se pierde al reiniciar). |
| `ESTADO_ARCHIVO` | `.agentcore/estado-avisos.json` | Dónde se guarda qué avisos ya se mandaron. |

### Telegram y avisos
| Variable | Default | Qué hace |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | Token del bot (BotFather). **Secreto.** |
| `TELEGRAM_CHAT_IDS` | — | Chats autorizados, separados por coma (lista cerrada). |
| `TELEGRAM_CHAT_IDS_SEGURIDAD` | (usa `TELEGRAM_CHAT_IDS`) | Chats de la línea Seguridad. |
| `SCHEDULER` | `off` | `on` activa el programador (resumen y alertas). |
| `RESUMEN_HORA` | `08:00` | Hora del resumen diario (`HH:MM`). |
| `ALERTAS_CADA_MIN` | `30` | Cada cuántos minutos revisa alertas. `0` = solo resumen. Entero 0–1440. |
| `ALERTAS_SILENCIO` | `22:00-08:00` | Franja sin alertas (`HH:MM-HH:MM`). `off` la quita. |
| `ALERTAS_MAX_DIA` | `5` | Tope de alertas por día y línea. Entero 0–100. |
| `AVISOS_NOMBRES` | off | `on` incluye nombres de clientes en Telegram. |
| `AVISOS_ZONA` | `America/Argentina/Buenos_Aires` | Zona horaria de los horarios y del "hoy". |
| `PUBLIC_URL` | — | Base del link a la bandeja que llevan los mensajes. |
| `TICK_MS` | `60000` | Cada cuántos ms corre el pulso interno del programador (mínimo 1000). No hace falta tocarlo. |

### IA del chat
| Variable | Default | Qué hace |
|---|---|---|
| `AI_PROVIDER` | `openai-compat` | `openai-compat`, `mock` (respuestas falsas) u `off`. |
| `AI_BASE_URL` | `http://localhost:11434/v1` | Endpoint compatible con OpenAI (Ollama por defecto). |
| `AI_MODEL` | `qwen2.5:1.5b` | Modelo. |
| `AI_API_KEY` | — | Clave, solo para APIs pagas. **Secreto.** |
| `AI_COST_IN_1K` / `AI_COST_OUT_1K` | `0` | Costo por 1000 tokens. `0` = local. |
| `AI_BUDGET_TENANT` | sin tope | Tope de gasto por tenant. |

### Producción futura (todavía no conectado)
`DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`: para cuando se enchufe el store Prisma y el login. Hoy no
hacen nada.

### Ejemplo de `.env` completo para tu servidor
Reemplazá los valores entre `<…>`.
```bash
# Datos reales
WISP_DATABASE_URL=postgresql://agentcore_ro:<clave-del-rol>@127.0.0.1:5432/guaynet
WISP_TENANT=guaynet
SEGURIDAD=on
SEGURIDAD_AVISO_DIAS=30
SEGURIDAD_URGENTE_DIAS=15

# Persistencia (los valores por defecto ya alcanzan; se listan para que sepas dónde está)
STORE_PERSISTENTE=on

# IA local
AI_PROVIDER=openai-compat
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=qwen2.5:1.5b

# Telegram
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_IDS=<tu-chat-id>
# TELEGRAM_CHAT_IDS_SEGURIDAD=<chat-del-equipo-de-guardia>
SCHEDULER=on
RESUMEN_HORA=08:00
ALERTAS_CADA_MIN=30
ALERTAS_SILENCIO=22:00-08:00
ALERTAS_MAX_DIA=5
AVISOS_ZONA=America/Argentina/Buenos_Aires
PUBLIC_URL=http://10.0.0.39:3100
```
Dejalo con permisos `600`: `chmod 600 ~/agent-core/apps/web/.env`.

---

## 12. Archivos que se generan, backups y restauración

Carpeta `apps/web/.agentcore/` (relativa al `WorkingDirectory` del servicio). Los archivos se crean con permisos `600`; la carpeta puede quedar con permisos más abiertos según cuál se cree primero, así que cerrala: `chmod 700 ~/agent-core/apps/web/.agentcore`.

| Archivo | Contenido | Permisos |
|---|---|---|
| `store.json` | agentes encendidos, alias, autonomía, bandeja con su historial, memoria de rechazos, gasto de IA | `600` |
| `estado-avisos.json` | qué avisos ya se mandaron (evita repetirlos al reiniciar) | `600` |

**Tienen datos de clientes: nunca los subas a GitHub ni los copies a lugares abiertos.**

### Cómo se guarda
- Escritura atómica (archivo temporal + renombrado) y agrupada (~0,5 s): un corte de luz no deja un JSON a medias, y se pierden como
  mucho los últimos instantes de cambios.
- Al arrancar, las recomendaciones **terminales** (ejecutadas, rechazadas, vencidas…) de más de 90 días se descartan; las vivas no.
- Si el archivo está dañado o es de otro formato, la app **arranca vacía y avisa** en el log; no se cae.
- Es para **una sola instancia** de la app.

### Backup
Manual:
```bash
mkdir -p ~/backups
cp -a ~/agent-core/apps/web/.agentcore ~/backups/agentcore-$(date +%F)
```
Diario con cron **(no probado)** — `crontab -e`:
```
0 3 * * * cp -a /home/joaquin/agent-core/apps/web/.agentcore /home/joaquin/backups/agentcore-$(date +\%F)
15 3 * * * cd /home/joaquin/guaynet && docker compose exec -T db pg_dump -U guaynet guaynet > /home/joaquin/backups/guaynet-$(date +\%F).sql
```
(El segundo requiere que `joaquin` pueda usar Docker.) Revisá de vez en cuando que los archivos existan y no pesen 0, y borrá los
viejos para no llenar el disco.

### Restaurar
```bash
sudo systemctl stop agent-core
rm -rf ~/agent-core/apps/web/.agentcore
cp -a ~/backups/agentcore-AAAA-MM-DD ~/agent-core/apps/web/.agentcore
chmod 700 ~/agent-core/apps/web/.agentcore && chmod 600 ~/agent-core/apps/web/.agentcore/*.json
sudo systemctl start agent-core
```

### Empezar de cero (borra agentes configurados y bandeja)
```bash
sudo systemctl stop agent-core
rm ~/agent-core/apps/web/.agentcore/store.json
sudo systemctl start agent-core
```
Si además querés que Gael vuelva a mandar el resumen de hoy, borrá también `estado-avisos.json`.

---

## 13. Actualizar a una versión nueva

```bash
cd ~/agent-core
git pull origin main
npm ci
npm run build                 # paquetes @agent-core/*  (obligatorio antes de next build)
cd apps/web
npx next build
sudo systemctl restart agent-core
journalctl -u agent-core -n 30 --no-pager
```
- Si el `git pull` se queja de cambios locales, **no los pises**: revisá con `git status` qué tocaste.
- Mirá en el log la línea `[store] persistente… N agente(s) configurado(s)`: confirma que los agentes se conservaron.
- Antes de actualizar, hacé el backup de `.agentcore/`.
- **Volver atrás:** `git log --oneline` para ver el commit anterior, `git checkout <commit>`, repetí `npm ci`, `npm run build`,
  `next build` y reiniciá. Después volvé con `git checkout main`.

---

## 14. Operación diaria

| Quiero… | Comando |
|---|---|
| Ver si está corriendo | `systemctl is-active agent-core` |
| Ver el log en vivo | `journalctl -u agent-core -f` |
| Últimas 100 líneas | `journalctl -u agent-core -n 100 --no-pager` |
| Reiniciar | `sudo systemctl restart agent-core` |
| Detener / iniciar | `sudo systemctl stop agent-core` / `start` |
| Ver quién usa el puerto | `ss -ltnp \| grep 3100` |
| Ver el estado de los avisos | `curl -s http://127.0.0.1:3100/api/asistente` |
| Ver las líneas | `curl -s http://127.0.0.1:3100/api/lineas` |
| Ver los agentes (JSON) | `curl -s http://127.0.0.1:3100/api/agents` |

### Mensajes del log y qué significan
| Mensaje | Significado |
|---|---|
| `[store] persistente en … · N agente(s), M recomendación(es)` | La persistencia cargó bien. |
| `[store] STORE_PERSISTENTE=off: …` | Está en modo memoria: se pierde todo al reiniciar. |
| `[store] … está dañado (JSON inválido): arranco vacío.` | El archivo estaba roto. Restaurá un backup. |
| `[store] no pude guardar …` | No puede escribir (permisos o disco lleno). Se reintenta con el próximo cambio. |
| `[avisos] programador activo · …` | Los avisos están funcionando. |
| `[avisos] SCHEDULER=on pero falta TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_IDS…` | Falta el token o los chats. |
| `[avisos] <VARIABLE> inválida …: uso <default>` | Un valor del `.env` está mal; usa el default. |
| `[run] falló la corrida: …` | La fuente de datos falló (ver `502` abajo). |

---

## 15. Resolución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `fatal: not a git repository` | Estás en la carpeta equivocada (por ejemplo `~`). | `cd ~/agent-core` y repetí. |
| `npm run buildcd: Missing script` | Error de tipeo. | El comando es `npm run build`. |
| `npm ci` falla por falta de `package-lock.json` | No estás en la raíz del repo. | `cd ~/agent-core`. |
| `next build` falla con módulos `@agent-core/*` no encontrados | Faltó compilar los paquetes. | En la raíz: `npm run build`, y repetí. |
| No carga desde tu PC pero `curl 127.0.0.1:3100` funciona | Firewall. | [Sección 4.4](#44-abrir-el-puerto-en-el-firewall-solo-para-tu-red). `Test-NetConnection` debe dar `True`. |
| `curl` da `Connection refused` | La app no está corriendo. | `systemctl status agent-core` y `journalctl -u agent-core -n 50`. |
| `Error: listen EADDRINUSE :::3100` | Otro proceso usa el puerto. | `ss -ltnp \| grep 3100`; cerrá ese proceso o cambiá el puerto. |
| Funciona a mano pero no como servicio | `PATH` de Node (nvm) o `WorkingDirectory` mal. | Revisá la unidad ([sección 5.2](#52-crear-la-unidad-de-systemd)) y `journalctl`. |
| Al reiniciar se pierden los agentes | `STORE_PERSISTENTE=off`, o el servicio corre desde otro directorio y guarda en otra carpeta. | Revisá el log `[store]` y el `WorkingDirectory`. |
| La home sigue diciendo datos de ejemplo | `WISP_DATABASE_URL` vacía o no se reinició. | Revisá el `.env` y reiniciá. |
| `/api/run` responde `502` ("falló la lectura de los datos") | La base no responde o la clave del rol es incorrecta. | Mirá el log. Probá el rol ([6.2](#62-verificar-el-rol-opcional-pero-recomendado)) y que el contenedor `db` esté arriba (`docker compose ps`). Hoy, si la base falla, falla **toda** la corrida. |
| `permission denied for table …` en el log | Faltó correr uno de los scripts SQL, o guaynet tiene tablas nuevas. | Corré de nuevo los dos `.sql` (son idempotentes salvo `CREATE ROLE`). |
| `password authentication failed for user "agentcore_ro"` | Clave equivocada en la URL. | `ALTER ROLE agentcore_ro PASSWORD '…'` y actualizá el `.env`. |
| `role "agentcore_ro" already exists` | El rol ya estaba. | Normal; seguí con el siguiente script, o cambiá la clave con `ALTER ROLE`. |
| La app no arranca y dice que `SEGURIDAD_TENANT` no puede ser igual… | Los dos tenants coinciden. | Cambiá `SEGURIDAD_TENANT`. |
| No aparece el selector Internet/Seguridad | `SEGURIDAD` no está en `on`, o falta `WISP_DATABASE_URL`. | Revisá ambas variables y reiniciá. |
| El chat responde `503` | No hay modelo, o Ollama está caído. | `systemctl status ollama`, `curl 127.0.0.1:11434/api/tags`, o `AI_PROVIDER=off`. |
| El chat responde `504` | El modelo tardó demasiado (CPU lenta). | Probá un modelo más chico o esperá; la primera respuesta es la más lenta. |
| El chat responde `429` | Se llegó a `AI_BUDGET_TENANT`. | Subí el tope o dejalo sin definir. |
| `npm run telegram:chat-id` dice que no hay chats | No le mandaste /start al bot. | Abrí el bot, mandá `/start` y repetí. |
| No llega el mensaje de prueba | Token mal, chat id mal, o no le diste /start. | `curl -s http://127.0.0.1:3100/api/asistente` (`telegram` debe ser `true`) y revisá el log. |
| Prueba responde `503` "Telegram no está configurado…" | Falta `TELEGRAM_BOT_TOKEN` o `TELEGRAM_CHAT_IDS`. | Completá el `.env` y reiniciá. |
| Prueba responde `429` | Mandaste otra hace menos de 30 s. | Esperá. |
| `SCHEDULER=on` pero no llega el resumen | Gael no está encendido en esa línea, o es antes de `RESUMEN_HORA`, o se pasó la ventana de 2 h. | Encendé a Gael en `/consola` (en cada línea) y revisá `/api/asistente`. |
| No llegan alertas de noche | Franja de silencio. | Es lo esperado. Cambiá `ALERTAS_SILENCIO` u `off`. |
| Llegan pocas alertas | Tope diario. | Subí `ALERTAS_MAX_DIA`. Lo que sobra va al resumen. |
| Demasiados "riesgo de abandono" | El umbral de ese agente es genérico (≈30 días entre pagos). | Es una calibración pendiente con datos reales. |
| Un cambio del `.env` no hace efecto | No se reinició el servicio. | `sudo systemctl restart agent-core`. |

Si algo no está acá, copiá el **mensaje de error completo del log** (sin claves) y revisalo con calma antes de tocar nada.

---

## 16. Endurecimiento de guaynet

Esta sección es sobre el repo `joacov7/guaynet`, no sobre agent-core, pero afecta a la instalación porque guaynet es la fuente de datos.

**Estado al escribir esto (1/11/2026):** la rama `claude/wisp-management-system-TTAsI` ya enlaza Postgres y Redis a `127.0.0.1` en su
`docker-compose.yml` y aborta el arranque si `SECRET_KEY` o `ENCRYPTION_KEY` faltan. El PR #3 de guaynet (`claude/endurecimiento-arranque`)
agrega:
- rechazo de los valores de ejemplo de `.env.example` (`your-secret-key-here…`, `your-fernet-key-here`);
- validación de `ENCRYPTION_KEY` como clave Fernet válida al arrancar;
- el primer admin no se crea con contraseña vacía o `changeme` (un admin existente no se ve afectado);
- `docker-compose.dev.yml` con Postgres y Redis solo en loopback;
- tests y un workflow de CI para eso.

Verificá en GitHub si ese PR ya se mergeó antes de dar por hecho que lo tenés.

### Antes de actualizar guaynet
1. Respaldo de la base ([6.0](#60-antes-de-empezar)).
2. Revisá que el `.env` de guaynet tenga claves reales **sin mostrarlas**:
   ```bash
   grep -E '^(SECRET_KEY|ENCRYPTION_KEY|FIRST_SUPERUSER_PASSWORD)=' ~/guaynet/.env | sed 's/=.*/=<definida>/'
   ```
   Ninguna debe empezar con `your-`, ni valer `changeme`, ni estar vacía.
3. Generar claves nuevas (solo si faltan):
   ```bash
   openssl rand -hex 32                                                                          # SECRET_KEY
   python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"   # ENCRYPTION_KEY
   ```
   **Cambiar `SECRET_KEY` cierra todas las sesiones abiertas.** Si ya hay datos cifrados con una `ENCRYPTION_KEY`, **no la cambies**:
   perderías el acceso a esas credenciales. Si todavía no había clave, poner una ahora no rompe lo ya guardado (se lee tal cual y
   se cifra la próxima vez que se guarde).
4. Si el backend **no arranca** después de actualizar, el mensaje de error dice qué variable está mal: `docker compose logs backend`.

### Qué NO cambia
La contraseña de la base (`guaynet:guaynet`) no se cambió: ya no es alcanzable desde la red (solo loopback), y cambiarla en una
instalación existente obliga a migrar el volumen de Postgres.

---

## 17. Limitaciones conocidas

- **No tiene login.** Ver [sección 10](#10-seguridad-de-acceso-la-app-no-tiene-login).
- **Una sola instancia** de la app (el store es un archivo). Para varias instancias o más volumen: `@agent-core/store-prisma` (Postgres).
- **Si la base de guaynet falla durante una corrida, falla toda la corrida** (el motor todavía no aísla por agente); `/api/run` responde `502`.
- **Solo lectura:** los agentes recomiendan, no ejecutan acciones sobre guaynet.
- **Misma programación para las dos líneas** (horario del resumen, silencio nocturno y tope diario).
- **Seguridad no se factura en guaynet todavía:** no hay agentes de cobro en esa línea. Cuando empiece a facturarse hay que sumar ese adapter.
- **Riesgo de abandono** usa un umbral genérico; puede generar ruido hasta calibrarlo con tus datos.
- **Equipos caídos** dependen de que guaynet actualice `status` / `last_seen`; con estado `unknown` no hay incidentes.
- **Un corte brusco** puede perder los últimos ~0,5 s de cambios de configuración.
- **El chat con un modelo chico** (1,5 B) sirve para explicar hallazgos, no para analizar cifras ni mercado.
- **Probado** con una base Postgres 16 con el esquema real de guaynet (43 migraciones), con servidores simulados de Telegram y de IA, y con la app real en modo demo. **No** se probó contra tu base real ni con tu bot real de Telegram: son los primeros pasos de verificación en tu servidor.
- La API acepta configurar un `agentId` que no existe en el catálogo (se guarda pero no hace nada).

---

## 18. Checklist final

Marcá cada punto en tu servidor:

**Instalación**
- [ ] `git log --oneline -3` muestra la versión esperada y `npm run build` terminó sin errores
- [ ] `apps/web/.env` existe, con permisos `600` (y `.agentcore/` con `700`)
- [ ] `next build` terminó sin errores
- [ ] El servicio `agent-core` está `active` y arranca solo tras reiniciar el servidor
- [ ] Desde tu PC: `Test-NetConnection 10.0.0.39 -Port 3100` da `True` (o entrás por túnel SSH)

**Datos**
- [ ] Respaldo reciente de la base de guaynet (no pesa 0 bytes)
- [ ] Rol `agentcore_ro` creado; `select * from users` da `permission denied`
- [ ] La home dice "● Datos reales del WISP"
- [ ] (Si usás Seguridad) corriste `solo-lectura-seguridad.sql` y aparece el selector

**Funcionamiento**
- [ ] Encendiste agentes, corriste el equipo y hay hallazgos en `/bandeja`
- [ ] Reiniciaste el servicio y los agentes y la bandeja siguen ahí
- [ ] (Chat) `ollama` responde y el chat de un agente contesta
- [ ] (Telegram) el mensaje de prueba llegó, **en cada línea**
- [ ] `SCHEDULER=on`, Gael encendido en cada línea, y el log dice `programador activo`

**Seguridad y operación**
- [ ] Elegiste una opción de acceso (A, B o C) y la app **no** está expuesta a internet
- [ ] `.env`, `.agentcore/` y los respaldos `.sql` están fuera de git
- [ ] Backup diario de `.agentcore/` y de la base de guaynet, y probaste restaurar uno
- [ ] Revisaste el `.env` de guaynet (sección 16) antes de actualizarlo

---

## 19. Desinstalar o volver atrás

### Dejar de usar agent-core (no toca guaynet)
```bash
sudo systemctl disable --now agent-core
sudo rm /etc/systemd/system/agent-core.service && sudo systemctl daemon-reload
sudo ufw delete allow from 10.0.0.0/24 to any port 3100 proto tcp    # o desde `ufw status numbered`
rm -rf ~/agent-core                                                   # borra también .agentcore/ (hacé backup antes si lo querés)
```

### Quitar el acceso de la app a la base de guaynet
```bash
cd ~/guaynet
docker compose exec db psql -U guaynet -d guaynet -c "DROP OWNED BY agentcore_ro; DROP ROLE agentcore_ro;"
```
`DROP OWNED BY` revoca los permisos antes de borrar el rol. Después de esto, la app (si sigue corriendo) falla al leer: sacá
`WISP_DATABASE_URL` del `.env` para volver al modo demo.

### Apagar solo los avisos
`SCHEDULER=off` (o borrá la línea) y reiniciá. O apagá a Gael en `/consola`. Mientras no haya `TELEGRAM_BOT_TOKEN`, no se manda nada.

### Quitar la IA local
```bash
sudo systemctl disable --now ollama
ollama rm qwen2.5:1.5b
```
y poné `AI_PROVIDER=off` en el `.env`.

---

*Más detalle por tema: [`apps/web/README.md`](../apps/web/README.md) (app, API, avisos, IA, producción) y
[`apps/wisp/README.md`](../apps/wisp/README.md) (mapeo de datos, SQL, línea Seguridad, tests).*
