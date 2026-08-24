import { defineConfig } from "vitest/config";

// Unit tests puros (sin DB) co-locados junto a cada módulo como *.logic.test.ts.
// Son la red de paridad: si pasan, la lógica portada de Regionales se preservó.
export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
