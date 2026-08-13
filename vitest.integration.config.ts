import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/integration/support/global-setup.ts"],
    fileParallelism: false,
    sequence: { shuffle: true },
    env: {
      NODE_ENV: "test",
      APP_BASE_URL: "http://127.0.0.1:5173",
      API_BASE_URL: "http://127.0.0.1:3000",
      SESSION_SECRET: "integration-only-session-secret-not-for-production",
      APP_ENCRYPTION_KEY:
        "1111111111111111111111111111111111111111111111111111111111111111",
      TRUST_PROXY: "0",
      ALLOWED_ORIGINS: "http://127.0.0.1:5173",
      PORT: "3000",
    },
  },
});
