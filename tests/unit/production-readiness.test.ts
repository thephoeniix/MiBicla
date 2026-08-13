import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("artefactos y operación de producción", () => {
  it("separa la condición TypeScript del entorno development", () => {
    for (const path of [
      "packages/shared/package.json",
      "packages/api-contract/package.json",
      "packages/db/package.json",
    ]) {
      const packageJson = read(path);
      expect(packageJson).toContain('"source": "./src/');
      expect(packageJson).not.toContain('"development": "./src/');
      expect(packageJson).toContain('"default": "./dist/');
    }
  });

  it("usa origen relativo en el frontend compilado y loopback en la API", () => {
    expect(read("artifacts/web/lib/api-client.ts")).toMatch(/import\.meta\.env\.PROD\s*\?\s*""/);
    expect(read("artifacts/api/src/index.ts")).toContain("app.listen(env.PORT, env.HOST");
    expect(read("packages/shared/src/env.ts")).toContain('HOST !== "127.0.0.1"');
  });

  it("incluye salud, migración confirmada, respaldo y rollback", () => {
    expect(read("artifacts/api/src/app.ts")).toContain('app.get("/readyz"');
    expect(read("packages/db/src/migrate.ts")).toContain("MIGRATION_CONFIRM");
    expect(read("packages/db/src/seed.ts")).toContain("SEED_CONFIRM");
    expect(read("scripts/backup-db.sh")).toContain("pg_dump --format=custom");
    expect(read("scripts/rollback-release.sh")).toContain("restore_previous");
    const service = read("deploy/mi-bicla-api.service");
    expect(service).toContain("Restart=on-failure");
    expect(service).toContain("UPLOAD_DIR=/var/lib/mibicla/uploads");
    expect(read("docs/production-runbook.md")).toContain("/var/lib/mibicla/uploads");
  });
});
