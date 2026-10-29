/**
 * ¿Es un error de esta clase? Se compara por NOMBRE y no con `instanceof`: Next compila
 * `instrumentation.ts` (que arranca el servicio y el programador) y las rutas como bundles
 * separados, y cada uno trae su PROPIA copia de cada módulo. Un error lanzado desde una copia
 * no es `instanceof` de la clase importada en la otra, y los 400/429/503 se volvían 500.
 */
export const esError = (e: unknown, nombre: string): e is Error => e instanceof Error && e.name === nombre;
