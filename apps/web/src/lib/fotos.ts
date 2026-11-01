import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { chmod, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Fotos de los agentes: el tenant le pone cara a cada uno. Se guardan como archivos, una carpeta por
 * línea (tenant): `<FOTOS_DIR>/<tenant>/<agente>.<png|jpg|webp>`. Sin foto, la app muestra el avatar generado.
 *
 * La app todavía no tiene login, así que lo que se acepta es lo mínimo y se valida todo:
 *  - solo PNG, JPEG y WebP, reconocidos por los **bytes** de la cabecera (nunca por el nombre ni el `Content-Type`
 *    del cliente). SVG queda afuera a propósito: puede llevar scripts.
 *  - hasta 512 KB, cortando la lectura apenas se pasa (no se bufferea un cuerpo gigante).
 *  - tenant y agente con un formato estricto: no hay forma de salir de la carpeta (`../`).
 *  - al servirla se manda `nosniff` y una CSP sin nada permitido, aunque el archivo no fuera una imagen real.
 */

export const FOTO_MAX_BYTES = 512 * 1024;

export type ExtFoto = "png" | "jpg" | "webp";
const MIME: Record<ExtFoto, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const EXTS = Object.keys(MIME) as ExtFoto[];

/** Foto rechazada. `status` es el código HTTP que corresponde (400, 413 o 415). */
export class ErrorDeFoto extends Error {
  override name = "ErrorDeFoto";
  constructor(mensaje: string, readonly status: 400 | 413 | 415) { super(mensaje); }
}

/** Qué imagen es, mirando los primeros bytes. `null` si no es PNG, JPEG ni WebP. */
export function detectarImagen(b: Uint8Array): { ext: ExtFoto; mime: string } | null {
  const es = (desde: number, ...bytes: number[]) => bytes.every((x, i) => b[desde + i] === x);
  if (b.length >= 8 && es(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { ext: "png", mime: MIME.png };
  if (b.length >= 3 && es(0, 0xff, 0xd8, 0xff)) return { ext: "jpg", mime: MIME.jpg };
  if (b.length >= 12 && es(0, 0x52, 0x49, 0x46, 0x46) && es(8, 0x57, 0x45, 0x42, 0x50)) return { ext: "webp", mime: MIME.webp };
  return null;
}

/** Lee el cuerpo de un request cortando al pasar `max` bytes (no confía en `Content-Length`). */
export async function leerCuerpoAcotado(req: Request, max = FOTO_MAX_BYTES): Promise<Uint8Array> {
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > max) throw new ErrorDeFoto(`La foto no puede pesar más de ${Math.round(max / 1024)} KB.`, 413);
  const lector = req.body?.getReader();
  if (!lector) throw new ErrorDeFoto("Falta la imagen.", 400);
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await lector.cancel().catch(() => undefined);
      throw new ErrorDeFoto(`La foto no puede pesar más de ${Math.round(max / 1024)} KB.`, 413);
    }
    trozos.push(value);
  }
  if (total === 0) throw new ErrorDeFoto("Falta la imagen.", 400);
  const salida = new Uint8Array(total);
  let pos = 0;
  for (const t of trozos) { salida.set(t, pos); pos += t.length; }
  return salida;
}

const TENANT_OK = /^[A-Za-z0-9_-]{1,64}$/;
const AGENTE_OK = /^[a-z0-9_]{1,40}$/;
const ARCHIVO = /^([a-z0-9_]{1,40})\.(png|jpg|webp)$/;

export interface FotoLeida { bytes: Uint8Array; mime: string; /** Cambia cada vez que se reemplaza (sirve de ETag y para saltear la caché del navegador). */ version: number }

export interface AlmacenFotos {
  guardar(tenantId: string, agentId: string, bytes: Uint8Array): Promise<{ ext: ExtFoto; mime: string }>;
  leer(tenantId: string, agentId: string): FotoLeida | null;
  borrar(tenantId: string, agentId: string): Promise<boolean>;
  /** `agentId → URL` de las fotos de una línea. Un solo `readdir`, por eso se puede llamar en cada listado. */
  urls(tenantId: string): Record<string, string>;
}

export const urlDeFoto = (agentId: string, version: number) => `/api/agents/${agentId}/foto?v=${version}`;

export function crearAlmacenFotos(dir: string): AlmacenFotos {
  const carpeta = (tenantId: string) => {
    if (!TENANT_OK.test(tenantId)) throw new ErrorDeFoto("Línea inválida.", 400);
    return join(dir, tenantId);
  };
  const validarAgente = (agentId: string) => {
    if (!AGENTE_OK.test(agentId)) throw new ErrorDeFoto("Agente inválido.", 400);
  };
  const version = (ruta: string) => Math.floor(statSync(ruta).mtimeMs);

  return {
    async guardar(tenantId, agentId, bytes) {
      const dirTenant = carpeta(tenantId);
      validarAgente(agentId);
      if (bytes.length === 0) throw new ErrorDeFoto("Falta la imagen.", 400);
      if (bytes.length > FOTO_MAX_BYTES) throw new ErrorDeFoto(`La foto no puede pesar más de ${Math.round(FOTO_MAX_BYTES / 1024)} KB.`, 413);
      const tipo = detectarImagen(bytes);
      if (!tipo) throw new ErrorDeFoto("Solo se aceptan imágenes PNG, JPG o WebP.", 415);

      await mkdir(dirTenant, { recursive: true, mode: 0o700 });
      const destino = join(dirTenant, `${agentId}.${tipo.ext}`);
      const tmp = `${destino}.${process.pid}.tmp`;
      await writeFile(tmp, bytes, { mode: 0o600 });
      await chmod(tmp, 0o600);
      await rename(tmp, destino); // atómico: nadie ve una foto a medio escribir
      // Una sola foto por agente: si antes era PNG y ahora JPG, el PNG viejo se va.
      await Promise.all(EXTS.filter((e) => e !== tipo.ext).map((e) => rm(join(dirTenant, `${agentId}.${e}`), { force: true })));
      return tipo;
    },

    leer(tenantId, agentId) {
      const dirTenant = carpeta(tenantId);
      validarAgente(agentId);
      for (const ext of EXTS) {
        const ruta = join(dirTenant, `${agentId}.${ext}`);
        try {
          const bytes = readFileSync(ruta);
          return { bytes: new Uint8Array(bytes), mime: MIME[ext], version: version(ruta) };
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      }
      return null;
    },

    async borrar(tenantId, agentId) {
      const dirTenant = carpeta(tenantId);
      validarAgente(agentId);
      let habia = false;
      const presentes = await readdir(dirTenant).catch(() => [] as string[]);
      for (const ext of EXTS) {
        const nombre = `${agentId}.${ext}`;
        if (presentes.includes(nombre)) { await rm(join(dirTenant, nombre), { force: true }); habia = true; }
      }
      return habia;
    },

    urls(tenantId) {
      if (!TENANT_OK.test(tenantId)) return {};
      const dirTenant = join(dir, tenantId);
      let nombres: string[];
      try { nombres = readdirSync(dirTenant); } catch { return {}; } // sin carpeta = sin fotos
      const salida: Record<string, string> = {};
      for (const nombre of nombres) {
        const m = ARCHIVO.exec(nombre);
        if (!m) continue; // ignora temporales y cualquier otra cosa
        try { salida[m[1]!] = urlDeFoto(m[1]!, version(join(dirTenant, nombre))); } catch { /* se borró entre medio */ }
      }
      return salida;
    },
  };
}

/** Almacén en `FOTOS_DIR` (default `.agentcore/fotos`, relativo al directorio de trabajo, junto al store). */
export function almacenDesdeEnv(env: Record<string, string | undefined>): AlmacenFotos {
  const dir = env.FOTOS_DIR?.trim() || ".agentcore/fotos";
  try { mkdirSync(dir, { recursive: true, mode: 0o700 }); chmodSync(dir, 0o700); } catch { /* se crea al guardar la primera */ }
  return crearAlmacenFotos(dir);
}
