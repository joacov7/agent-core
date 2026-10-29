// Ayuda de configuración: muestra tu chat_id de Telegram.
//   1) Creá el bot con @BotFather y poné TELEGRAM_BOT_TOKEN en el .env
//   2) Abrí tu bot en Telegram y mandale /start
//   3) npm run telegram:chat-id
import { descubrirChats, NotificadorError } from "@agent-core/notify-telegram";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN en el .env (te lo da @BotFather con /newbot).");
  process.exit(1);
}
try {
  const chats = await descubrirChats({ token, ...(process.env.TELEGRAM_API_URL ? { apiBase: process.env.TELEGRAM_API_URL } : {}) });
  if (chats.length === 0) {
    console.log("Todavía no hay chats. Abrí tu bot en Telegram, mandale /start y volvé a correr este comando.");
  } else {
    console.log("Chats que le escribieron a tu bot:\n");
    for (const c of chats) console.log(`  ${c.id}   (${c.tipo}: ${c.nombre})`);
    console.log("\nPoné el que corresponda en el .env:  TELEGRAM_CHAT_IDS=<id>   (varios, separados por coma)");
  }
} catch (e) {
  console.error(e instanceof NotificadorError ? e.message : "No pude consultar Telegram.");
  process.exit(1);
}
