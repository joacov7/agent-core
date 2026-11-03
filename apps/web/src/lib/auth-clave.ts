import { createHash, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Verificación de la clave de acceso (solo Node: scrypt). El hash se genera con `npm run auth:hash`
 * (`scripts/auth-hash.mjs`) y tiene la forma `scrypt:N:r:p:sal:hash` (base64). Si en cambio hay una `AUTH_CLAVE` en
 * claro, se compara por digest en tiempo constante. Nunca lanza: algo ilegible es `false`.
 */
const MAX_N = 2 ** 17; // tope para que un hash adulterado no pueda pedir memoria sin límite

const sha = (s: string) => createHash("sha256").update(s).digest();
const igual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

export function verificarClave(clave: string, material: string, enClaro: boolean): boolean {
  try {
    if (clave.length > 1024) return false; // no se hashean cuerpos gigantes
    if (enClaro) return igual(sha(clave), sha(material));
    const [alg, n, r, p, sal, hash] = material.split(":");
    if (alg !== "scrypt" || !sal || !hash) return false;
    const N = Number(n), R = Number(r), P = Number(p);
    if (![N, R, P].every(Number.isInteger) || N < 2 || N > MAX_N || R < 1 || R > 32 || P < 1 || P > 16) return false;
    const esperado = Buffer.from(hash, "base64");
    if (esperado.length < 16 || esperado.length > 128) return false;
    const calculado = scryptSync(clave, Buffer.from(sal, "base64"), esperado.length, { N, r: R, p: P, maxmem: 256 * 1024 * 1024 });
    return igual(calculado, esperado);
  } catch {
    return false;
  }
}

/** Compara el usuario sin filtrar por tiempo cuánto se parecía. */
export const mismoUsuario = (a: string, b: string) => igual(sha(a), sha(b));
