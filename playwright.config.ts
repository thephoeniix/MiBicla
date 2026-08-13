import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "https://mibicla.test:8443",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--host-resolver-rules=MAP mibicla.test 127.0.0.1"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
