import { authRuntime, resumenAuth } from "./lib/auth";
import { iniciarProgramador } from "./lib/avisos";

/** Arranque del servidor (solo Node): deja constancia del estado del acceso y levanta el programador de avisos. */
export function arrancar() {
  const r = resumenAuth(authRuntime().cfg);
  (r.nivel === "error" ? console.error : r.nivel === "warn" ? console.warn : console.log)(r.mensaje);
  iniciarProgramador();
}
