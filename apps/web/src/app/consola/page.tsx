"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { C, CAT_LABEL, CAT_ORDEN, ESTADO, type EstadoAgente, type PersonaVista } from "@/lib/ui";
import type { AjustesVista, CampoVista } from "@/lib/ajustes";

type Autonomia = "manual" | "assisted" | "autonomous";
interface Manifest {
  id: string; nombre: string; categoria: string; autonomiaMaxima: Autonomia;
  riesgo: string; nivelIA: string;
}
interface AgenteVista {
  manifest: Manifest; persona: PersonaVista; estado: EstadoAgente; novedades: number;
  disponible: boolean; encendido: boolean; autonomia: Autonomia; plan?: string; ajustes?: AjustesVista;
}
type Cambios = Partial<{ encendido: boolean; autonomia: Autonomia; plan: string; alias: string; config: Record<string, unknown> }>;

/** Mismo tope que el servidor (lib/fotos.ts, que no se puede importar acá: usa `fs`). El servidor lo vuelve a verificar. */
const FOTO_MAX_BYTES = 512 * 1024;
const FOTO_TIPOS = ["image/png", "image/jpeg", "image/webp"];

const ORDEN_AUT: Autonomia[] = ["manual", "assisted", "autonomous"];
const AUT_LABEL: Record<Autonomia, string> = { manual: "Manual", assisted: "Asistido", autonomous: "Autónomo" };
const TIERS = ["Free", "Pro", "Premium"];

export default function ConsolaPage() {
  const [agentes, setAgentes] = useState<AgenteVista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [resultado, setResultado] = useState<{ ejecutados: { agentId: string; recomendaciones: number }[]; total: number } | null>(null);

  async function cargar() {
    try {
      const r = await fetch("/api/agents");
      if (!r.ok) throw new Error(`GET /api/agents → ${r.status}`);
      setAgentes(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { void cargar(); }, []);

  /** Guarda un cambio del agente. Devuelve el mensaje de error del servidor (p.ej. un ajuste fuera de rango) o `null` si salió bien. */
  async function patch(v: AgenteVista, cambios: Cambios): Promise<string | null> {
    const { alias, config, ...cfg } = cambios;
    const next: AgenteVista = {
      ...v, ...cfg,
      ...(alias !== undefined ? { persona: { ...v.persona, nombre: alias.trim() || v.persona.nombre, personalizado: Boolean(alias.trim()) } } : {}),
    };
    setAgentes((xs) => xs.map((x) => (x.manifest.id === v.manifest.id ? next : x))); // optimista
    const body = {
      agentId: v.manifest.id, encendido: next.encendido, autonomia: next.autonomia,
      ...(next.plan ? { plan: next.plan } : {}),
      ...(alias !== undefined ? { alias } : {}), // sin alias en el body, el server conserva el que había
      ...(config !== undefined ? { config } : {}), // ídem ajustes; `{}` los restaura
    };
    try {
      const r = await fetch("/api/agents", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) {
        const msg = (await r.json().catch(() => null) as { error?: string } | null)?.error;
        void cargar(); // revertir desde el server si falló
        return msg ?? `No se pudo guardar (${r.status}).`;
      }
    } catch {
      void cargar();
      return "No pude conectar con el servidor.";
    }
    if (alias !== undefined || config !== undefined) void cargar(); // el server devuelve el nombre por defecto si se borró, y los ajustes vigentes
    return null;
  }

  /** Sube (o quita, con `null`) la foto de un agente. */
  async function foto(v: AgenteVista, archivo: File | null) {
    setAviso(null);
    const url = `/api/agents/${v.manifest.id}/foto`;
    try {
      if (archivo) {
        if (!FOTO_TIPOS.includes(archivo.type)) return setAviso("La foto tiene que ser PNG, JPG o WebP.");
        if (archivo.size > FOTO_MAX_BYTES) return setAviso(`La foto pesa ${Math.round(archivo.size / 1024)} KB: el máximo es ${FOTO_MAX_BYTES / 1024} KB.`);
        const r = await fetch(url, { method: "PUT", headers: { "content-type": archivo.type }, body: archivo });
        if (!r.ok) return setAviso((await r.json().catch(() => null) as { error?: string } | null)?.error ?? `No se pudo subir la foto (${r.status}).`);
      } else {
        const r = await fetch(url, { method: "DELETE" });
        if (!r.ok) return setAviso(`No se pudo quitar la foto (${r.status}).`);
      }
      await cargar();
    } catch {
      setAviso("No pude conectar con el servidor.");
    }
  }

  async function correr() {
    setCorriendo(true); setResultado(null);
    try {
      const r = await fetch("/api/run", { method: "POST" });
      setResultado(await r.json());
    } finally {
      setCorriendo(false);
    }
  }

  const disponibles = agentes.filter((a) => a.disponible);
  const encendidos = disponibles.filter((a) => a.encendido);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 64px" }}>
      <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: C.accentInk, margin: 0 }}>
        agent-core · consola · en vivo
      </p>
      <h1 style={{ fontSize: 32, margin: "6px 0 4px", letterSpacing: "-.02em" }}>Consola de Agentes</h1>
      <p style={{ color: C.soft, marginTop: 0 }}>
        Conectada a la API: <code>GET/PUT /api/agents</code> · <code>POST /api/run</code>. Los cambios se persisten
        en el <code>CoreStore</code> del tenant. Las recomendaciones que genera aparecen en la{" "}
        <a href="/bandeja" style={{ color: C.accentInk }}>bandeja</a>.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "16px 0 24px" }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.faint }}>
          {disponibles.length} disponibles · {encendidos.length} encendidos
        </span>
        <button onClick={correr} disabled={corriendo || encendidos.length === 0}
          style={{ marginLeft: "auto", background: C.accent, color: "#08211f", border: 0, borderRadius: 99, padding: "9px 18px", fontWeight: 600, cursor: corriendo ? "default" : "pointer", opacity: corriendo || encendidos.length === 0 ? 0.6 : 1 }}>
          {corriendo ? "Corriendo…" : "▶ Correr equipo"}
        </button>
      </div>

      {error && <p style={{ color: C.crit, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>⚠ {error}</p>}
      {aviso && <p role="alert" style={{ color: C.crit, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>⚠ {aviso}</p>}
      {cargando && <p style={{ color: C.faint }}>Cargando…</p>}

      {resultado && (
        <div style={{ border: `1px solid ${C.accent}`, background: "#0f3330", borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
          <b>Última corrida:</b> {resultado.total} recomendación(es) de {resultado.ejecutados.length} agente(s).
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.soft, marginTop: 6 }}>
            {resultado.ejecutados.map((e) => `${e.agentId} (${e.recomendaciones})`).join(" · ")}
          </div>
        </div>
      )}

      {CAT_ORDEN.filter((cat) => agentes.some((a) => a.manifest.categoria === cat)).map((cat) => {
        const items = agentes.filter((a) => a.manifest.categoria === cat);
        return (
          <section key={cat} style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 15, margin: "0 0 10px", color: C.ink }}>{CAT_LABEL[cat] ?? cat}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
              {items.map((a) => (
                <AgenteCard key={a.manifest.id} a={a} onPatch={patch} onFoto={foto} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}


type OnPatch = (v: AgenteVista, c: Cambios) => Promise<string | null>;

function AgenteCard({ a, onPatch, onFoto }: { a: AgenteVista; onPatch: OnPatch; onFoto: (v: AgenteVista, f: File | null) => void }) {
  const [editando, setEditando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [borrador, setBorrador] = useState(a.persona.nombre);
  const est = ESTADO[a.estado];
  function guardar() {
    setEditando(false);
    if (borrador.trim() !== a.persona.nombre) void onPatch(a, { alias: borrador.trim() });
  }
  const opts = ORDEN_AUT.slice(0, ORDEN_AUT.indexOf(a.manifest.autonomiaMaxima) + 1);
  const dis = !a.disponible;
  const fotoUrl = a.persona.fotoUrl;
  const chico = { background: "none", border: 0, color: C.faint, cursor: "pointer", fontSize: 12, marginLeft: 4, padding: 0 } as const;
  return (
    <div style={{
      border: `1px solid ${a.encendido ? C.accent : C.line}`, borderRadius: 12, padding: "13px 14px",
      background: dis ? "#121819" : C.surface, opacity: dis ? 0.55 : 1, display: "flex", flexDirection: "column", gap: 9,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <Avatar nombre={a.persona.nombre} categoria={a.manifest.categoria} size={38} estadoColor={est.color} {...(fotoUrl ? { fotoUrl } : {})} />
          <div style={{ minWidth: 0 }}>
            {editando ? (
              <input autoFocus value={borrador} maxLength={40} aria-label={`Nombre de ${a.persona.rol}`}
                onChange={(e) => setBorrador(e.target.value)} onBlur={guardar}
                onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") { setBorrador(a.persona.nombre); setEditando(false); } }}
                style={{ background: C.surface2, color: C.ink, border: `1px solid ${C.accent}`, borderRadius: 6, padding: "2px 6px", fontSize: 14, fontWeight: 700, width: 130 }} />
            ) : (
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {a.persona.nombre}
                <button onClick={() => { setBorrador(a.persona.nombre); setEditando(true); }} title="Ponerle otro nombre" aria-label={`Renombrar a ${a.persona.nombre}`}
                  style={chico}>✎</button>
                <FotoBoton a={a} onFoto={onFoto} estilo={chico} />
              </div>
            )}
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: C.faint, marginTop: 2 }}>
              {a.persona.rol} · {a.manifest.nivelIA !== "ninguno" ? "IA" : "sin IA"} · riesgo {a.manifest.riesgo}
            </div>
          </div>
        </div>
        <button role="switch" aria-checked={a.encendido} disabled={dis}
          onClick={() => void onPatch(a, { encendido: !a.encendido })}
          style={{ width: 42, height: 24, borderRadius: 99, border: `1px solid ${a.encendido ? C.accent : C.line}`, background: a.encendido ? C.accent : C.surface2, position: "relative", cursor: dis ? "not-allowed" : "pointer", flex: "0 0 auto" }}>
          <span style={{ position: "absolute", top: 2, left: a.encendido ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .14s" }} />
        </button>
      </div>

      {dis ? (
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.crit }}>no disponible (falta capacidad/cadencia)</div>
      ) : a.encendido ? (
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
          <label style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.faint, display: "flex", gap: 6, alignItems: "center" }}>
            autonomía
            <select value={a.autonomia} onChange={(e) => void onPatch(a, { autonomia: e.target.value as Autonomia })}
              style={{ background: C.surface2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 7, padding: "4px 7px", fontSize: 12 }}>
              {opts.map((o) => <option key={o} value={o}>{AUT_LABEL[o]}</option>)}
            </select>
          </label>
          <div style={{ display: "inline-flex", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
            {TIERS.map((t) => (
              <button key={t} onClick={() => void onPatch(a, { plan: t })}
                style={{ border: 0, borderRight: `1px solid ${C.line}`, background: (a.plan ?? "Pro") === t ? C.accent : C.surface2, color: (a.plan ?? "Pro") === t ? "#08211f" : C.soft, fontFamily: "ui-monospace, monospace", fontSize: 11, padding: "5px 9px", cursor: "pointer" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.faint }}>disponible · apagado</div>
      )}

      {!dis && a.ajustes && (
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
          <button onClick={() => setAjustando((x) => !x)} aria-expanded={ajustando}
            style={{ background: "none", border: 0, color: a.ajustes.personalizados.length > 0 ? C.accentInk : C.soft, cursor: "pointer", fontFamily: "ui-monospace, monospace", fontSize: 11, padding: 0 }}>
            ⚙ Ajustes {ajustando ? "▴" : "▾"}{a.ajustes.personalizados.length > 0 && !ajustando ? ` · ${a.ajustes.personalizados.length} personalizado${a.ajustes.personalizados.length === 1 ? "" : "s"}` : ""}
          </button>
          {ajustando && <AjustesForm a={a} ajustes={a.ajustes} onPatch={onPatch} />}
        </div>
      )}
    </div>
  );
}

function FotoBoton({ a, onFoto, estilo }: { a: AgenteVista; onFoto: (v: AgenteVista, f: File | null) => void; estilo: React.CSSProperties }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button onClick={() => ref.current?.click()} title="Ponerle una foto (PNG, JPG o WebP, hasta 512 KB)" aria-label={`Cambiar la foto de ${a.persona.nombre}`} style={estilo}>📷</button>
      {a.persona.fotoUrl && (
        <button onClick={() => onFoto(a, null)} title="Quitar la foto" aria-label={`Quitar la foto de ${a.persona.nombre}`} style={estilo}>✕</button>
      )}
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-hidden tabIndex={-1} data-testid={`foto-${a.manifest.id}`}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFoto(a, f); }} />
    </>
  );
}

/** ¿El texto del input es un valor válido para el campo? Mismas reglas que el servidor (lib/ajustes.ts). */
function problemaDeCampo(c: CampoVista, texto: string): string | null {
  if (c.tipo === "boolean") return null;
  if (c.tipo === "string") {
    if (c.maxLength !== undefined && texto.length > c.maxLength) return `máximo ${c.maxLength} caracteres`;
    return null;
  }
  if (texto.trim() === "") return "falta el valor";
  const n = Number(texto);
  if (!Number.isFinite(n)) return "tiene que ser un número";
  if (c.tipo === "integer" && !Number.isInteger(n)) return "tiene que ser un número entero";
  if (c.min !== undefined && n < c.min) return `mínimo ${c.min}`;
  if (c.max !== undefined && n > c.max) return `máximo ${c.max}`;
  return null;
}

function AjustesForm({ a, ajustes, onPatch }: { a: AgenteVista; ajustes: AjustesVista; onPatch: OnPatch }) {
  const aTexto = (v: Record<string, unknown>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)]));
  const [texto, setTexto] = useState<Record<string, string>>(() => aTexto(ajustes.valores));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const firma = JSON.stringify(ajustes.valores);
  // Si los valores vigentes cambian desde afuera (guardar, restaurar, recargar), el formulario los sigue.
  useEffect(() => { setTexto(aTexto(ajustes.valores)); }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps

  const problemas = Object.fromEntries(ajustes.campos.map((c) => [c.clave, problemaDeCampo(c, texto[c.clave] ?? "")]));
  const hayProblemas = Object.values(problemas).some(Boolean);
  const valorDe = (c: CampoVista): unknown => (c.tipo === "boolean" ? texto[c.clave] === "true" : c.tipo === "string" ? texto[c.clave] ?? "" : Number(texto[c.clave]));
  // Solo se guarda lo que difiere del valor por defecto: lo demás sigue al de la línea si ese cambia.
  const overrides = () => Object.fromEntries(ajustes.campos.filter((c) => valorDe(c) !== ajustes.porDefecto[c.clave]).map((c) => [c.clave, valorDe(c)]));
  const sinCambios = JSON.stringify(Object.entries(overrides()).sort()) === JSON.stringify(Object.entries(Object.fromEntries(ajustes.personalizados.map((k) => [k, ajustes.valores[k]]))).sort());

  async function enviar(config: Record<string, unknown>) {
    setGuardando(true); setError(null);
    const msg = await onPatch(a, { config });
    setGuardando(false);
    if (msg) setError(msg);
  }
  const campo: React.CSSProperties = { background: C.surface2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 7, padding: "4px 7px", fontSize: 12, width: 84 };
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!hayProblemas) void enviar(overrides()); }} style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 8 }}>
      {ajustes.campos.map((c) => {
        const propio = ajustes.personalizados.includes(c.clave);
        const mal = problemas[c.clave];
        const id = `aj-${a.manifest.id}-${c.clave}`;
        return (
          <div key={c.clave}>
            <label htmlFor={id} style={{ fontSize: 12, color: C.ink, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 130px" }}>{c.titulo}{propio && <span title="Valor propio (no el de fábrica)" style={{ color: C.accentInk }}> ●</span>}</span>
              {c.tipo === "boolean" ? (
                <input id={id} type="checkbox" checked={texto[c.clave] === "true"} onChange={(e) => setTexto((t) => ({ ...t, [c.clave]: String(e.target.checked) }))} />
              ) : c.opciones ? (
                <select id={id} value={texto[c.clave] ?? ""} onChange={(e) => setTexto((t) => ({ ...t, [c.clave]: e.target.value }))} style={campo}>
                  {c.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input id={id} inputMode={c.tipo === "string" ? "text" : "decimal"} value={texto[c.clave] ?? ""} aria-invalid={Boolean(mal)}
                  onChange={(e) => setTexto((t) => ({ ...t, [c.clave]: e.target.value }))}
                  style={{ ...campo, borderColor: mal ? C.crit : C.line }} />
              )}
              {c.unidad && <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: C.faint, minWidth: 32 }}>{c.unidad}</span>}
            </label>
            {c.descripcion && <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{c.descripcion}</div>}
            {mal && <div role="alert" style={{ fontSize: 11, color: C.crit, marginTop: 2 }}>{mal}</div>}
            {propio && !mal && <div style={{ fontSize: 10.5, color: C.faint, marginTop: 2 }}>de fábrica: {String(ajustes.porDefecto[c.clave])}{c.unidad ? ` ${c.unidad}` : ""}</div>}
          </div>
        );
      })}
      {error && <div role="alert" style={{ fontSize: 12, color: C.crit }}>⚠ {error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={guardando || hayProblemas || sinCambios}
          style={{ background: C.accent, color: "#08211f", border: 0, borderRadius: 99, padding: "5px 14px", fontWeight: 600, fontSize: 12, cursor: guardando || hayProblemas || sinCambios ? "default" : "pointer", opacity: guardando || hayProblemas || sinCambios ? 0.5 : 1 }}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" disabled={guardando || ajustes.personalizados.length === 0} onClick={() => void enviar({})}
          style={{ background: "none", color: C.soft, border: `1px solid ${C.line}`, borderRadius: 99, padding: "5px 12px", fontSize: 12, cursor: "pointer", opacity: guardando || ajustes.personalizados.length === 0 ? 0.5 : 1 }}>
          Restaurar valores
        </button>
      </div>
    </form>
  );
}
