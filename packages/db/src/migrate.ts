import "dotenv/config";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client.js";
if (process.env.NODE_ENV === "production" && process.env.MIGRATION_CONFIRM !== "APPLY") {
  throw new Error("Producción requiere MIGRATION_CONFIRM=APPLY");
}
const { db, client } = createDatabase(process.env.DATABASE_URL, { max: 1 });
try {
  await db.execute(sql`select pg_advisory_lock(hashtext('mi-bicla-migrations'))`);
  await migrate(db, {
    migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
  });
} finally {
  await db.execute(sql`select pg_advisory_unlock(hashtext('mi-bicla-migrations'))`).catch(() => undefined);
  await client.end();
}
console.log("Migraciones aplicadas.");
