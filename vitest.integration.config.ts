import { defineConfig } from "vitest/config";

export default defineConfig({
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
