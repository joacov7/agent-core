import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests puros (sin DB) co-locados junto a cada módulo como *.logic.test.ts.
// Son la red de paridad: si pasan, la lógica portada de Regionales se preservó.
export default defineConfig({
  // `@/…` es el alias de apps/web/src (lo usan las rutas de la app web; regex estricta para no chocar con `@agent-core/*`).
  resolve: { alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./apps/web/src/", import.meta.url)) }] },
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
