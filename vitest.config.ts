import { fileURLToPath } from "node:url";
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ["source"],
    alias: {
      "@mi-bicla/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@mi-bicla/api-contract": fileURLToPath(new URL("./packages/api-contract/src/index.ts", import.meta.url)),
      "@mi-bicla/db": fileURLToPath(new URL("./packages/db/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
});
