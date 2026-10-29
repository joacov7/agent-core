# @agent-core/notify-telegram

`Notificador` por **Telegram** (Bot API) para agent-core. **Solo envía**: no hay webhook ni comandos
entrantes, así que no expone ningún puerto y nadie puede darle órdenes al sistema por el chat. Sin
dependencias (usa `fetch`).

```ts
import { crearNotificadorTelegram } from "@agent-core/notify-telegram";
const n = crearNotificadorTelegram({ token: process.env.TELEGRAM_BOT_TOKEN!, chatIds: ["123456789"] });
await n.enviar(ctx, { texto: "Buen día: hay 3 cobros vencidos." });
```

## Configurarlo
1. En Telegram, hablale a **@BotFather** → `/newbot` → te da el **token**.
2. Abrí tu bot y mandale **/start** (un bot no puede escribirle a quien no lo inició).
3. Obtené tu `chat_id`: `descubrirChats({ token })` lista los chats que le escribieron.

## Garantías
- Manda **solo** a los `chatIds` configurados (lista cerrada).
- El **token nunca aparece** en errores ni logs (la URL lo lleva: los errores se arman sin ella).
- Errores tipados (`NotificadorError.causa`): `token_invalido`, `chat_invalido`, `limite` (con `reintentarEn`),
  `red`, `timeout`, `http`, `configuracion`. No reintenta solo: quien llama decide.
- Parte los mensajes de más de 4096 caracteres en trozos, cortando en saltos de línea.
- Texto plano (sin `parse_mode`): un nombre con `_` o `*` no rompe el envío.

> Ojo con la privacidad: los chats normales de Telegram **no** tienen cifrado de extremo a extremo.
> No mandes datos personales de terceros que no quieras que pasen por sus servidores.
