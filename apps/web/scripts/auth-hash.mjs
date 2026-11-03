// Ayuda de configuración: genera el hash de la clave de acceso para el .env.
//   npm run auth:hash        → te pide la clave (no se ve al escribirla) y imprime la línea AUTH_CLAVE_HASH=...
// El hash es scrypt con sal aleatoria: aunque alguien lea el .env no obtiene la clave, y dos hashes de la misma clave son distintos.
import { randomBytes, scryptSync } from "node:crypto";
import { pathToFileURL } from "node:url";

export const MIN_CLAVE = 10;
const N = 32768, R = 8, P = 1, LARGO = 32;

/**
 * `scrypt:N:r:p:sal:hash` (base64). Lo verifica `src/lib/auth-clave.ts`.
 * El separador es `:` y NO `$` a propósito: Next expande los `$` de los archivos .env (`$32768` se lee como una variable vacía)
 * y el hash llegaría roto.
 */
export function hashearClave(clave) {
  if (typeof clave !== "string" || clave.length < MIN_CLAVE) throw new Error(`La clave tiene que tener al menos ${MIN_CLAVE} caracteres.`);
  const sal = randomBytes(16);
  const hash = scryptSync(clave, sal, LARGO, { N, r: R, p: P, maxmem: 128 * 1024 * 1024 });
  return `scrypt:${N}:${R}:${P}:${sal.toString("base64")}:${hash.toString("base64")}`;
}

/** Sin terminal (stdin por pipe) se lee todo de una vez y se reparte por líneas: una lectura por pregunta perdería la segunda línea. */
let lineasPipe = null;
async function leerLineasPipe() {
  const partes = [];
  for await (const trozo of process.stdin) partes.push(trozo);
  return Buffer.concat(partes).toString("utf8").split("\n").map((l) => l.replace(/\r$/, ""));
}

/** Lee una línea sin mostrarla (modo raw). Si no hay terminal, la toma del stdin tal cual. */
async function leerOculto(pregunta) {
  const { stdin, stdout } = process;
  stdout.write(pregunta);
  if (!stdin.isTTY) {
    lineasPipe ??= await leerLineasPipe();
    stdout.write("\n");
    return lineasPipe.shift() ?? "";
  }
  return new Promise((resolve, reject) => {
    let clave = "";
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    const fin = () => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", on); stdout.write("\n"); };
    const on = (c) => {
      for (const ch of c) {
        if (ch === "\u0003") { fin(); reject(new Error("Cancelado.")); return; }       // Ctrl-C
        if (ch === "\r" || ch === "\n") { fin(); resolve(clave); return; }
        if (ch === "\u007f" || ch === "\b") clave = clave.slice(0, -1);              // borrar
        else if (ch >= " ") clave += ch;
      }
    };
    stdin.on("data", on);
  });
}

async function main() {
  const a = await leerOculto("Clave nueva (mínimo 10 caracteres): ");
  if (a.length < MIN_CLAVE) throw new Error(`Muy corta: mínimo ${MIN_CLAVE} caracteres. Una frase larga es mejor que una palabra rara.`);
  const b = await leerOculto("Repetila: ");
  if (a !== b) throw new Error("No coinciden. No se generó nada.");
  console.log("\nPegá esta línea en apps/web/.env (y borrá cualquier AUTH_CLAVE= que hubiera):\n");
  console.log(`AUTH_CLAVE_HASH=${hashearClave(a)}`);
  console.log("\nOpcional: AUTH_USUARIO=<nombre> (por defecto \"admin\") y AUTH_HORAS=<horas de sesión> (por defecto 12).");
  console.log("Después reiniciá la app: sudo systemctl restart agent-core");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
