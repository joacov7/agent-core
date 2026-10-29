"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/ui";

interface Estado {
  programador: "activo" | "apagado" | "sin_canal"; telegram: boolean; asistenteEncendido: boolean; asistente: string;
  resumenHora: string; alertasCadaMin: number; silencio: string | null; enSilencioAhora: boolean; maxAlertasDia: number;
  avisosHoy: number; huboError: boolean; ultimoResumen?: string;
}

/** Estado de los avisos por Telegram del Asistente personal + botón de prueba. */
export function PanelAvisos() {
  const [e, setE] = useState<Estado | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    try { const r = await fetch("/api/asistente"); if (r.ok) setE(await r.json()); } catch { /* sin estado: no se muestra nada */ }
  }
  useEffect(() => { void cargar(); }, []);

  async function probar() {
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch("/api/asistente/prueba", { method: "POST" });
      const j = await r.json();
      setMsg(r.ok ? { ok: true, texto: "Listo: revisá Telegram." } : { ok: false, texto: j.error ?? `Error ${r.status}` });
    } catch { setMsg({ ok: false, texto: "No pude conectar con la app." }); }
    finally { setEnviando(false); }
  }

  if (!e) return null;
  let linea: string; let color = C.soft;
  if (!e.telegram) { linea = "🔕 Telegram sin configurar: poné TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_IDS en el .env (guía en apps/web/README)."; color = C.warn; }
  else if (!e.asistenteEncendido) { linea = `😴 ${e.asistente} está apagado: encendelo en la consola para recibir avisos.`; color = C.warn; }
  else if (e.programador === "apagado") { linea = "⏸ Avisos programados apagados (SCHEDULER=off). Podés mandar una prueba."; color = C.warn; }
  else if (e.programador === "sin_canal") { linea = "⚠ SCHEDULER=on pero falta configurar Telegram."; color = C.crit; }
  else {
    linea = `🔔 Avisos por Telegram activos · resumen ${e.resumenHora}` +
      (e.alertasCadaMin ? ` · alertas cada ${e.alertasCadaMin} min${e.silencio ? ` (silencio ${e.silencio})` : ""} · hoy ${e.avisosHoy}/${e.maxAlertasDia}` : " · sin alertas");
    color = C.accent;
  }
  return (
    <div style={{ border: `1px solid ${C.line}`, background: C.surface, borderRadius: 12, padding: "10px 14px", margin: "14px 0 4px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ color, fontSize: 13.5 }}>{linea}{e.huboError ? " · ⚠ hubo un error reciente (ver el log del server)" : ""}</span>
      {e.telegram && (
        <button onClick={() => void probar()} disabled={enviando}
          style={{ marginLeft: "auto", border: `1px solid ${C.line}`, background: C.surface2, color: C.ink, borderRadius: 99, padding: "6px 13px", fontSize: 12.5, cursor: "pointer", opacity: enviando ? 0.6 : 1 }}>
          {enviando ? "Enviando…" : "Enviar mensaje de prueba"}
        </button>
      )}
      {msg && <span style={{ width: "100%", fontSize: 12.5, color: msg.ok ? C.accentInk : C.crit }}>{msg.texto}</span>}
    </div>
  );
}
