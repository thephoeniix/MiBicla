import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createTestDatabase } from "./test-database.js";

export default async function setup() {
  const { db, client } = createTestDatabase();
  try {
    await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await client.unsafe("CREATE SCHEMA public");
    await migrate(db, {
      migrationsFolder: new URL(
        "../../../packages/db/drizzle",
        import.meta.url,
      ).pathname,
    });
  } finally {
    await client.end();
  }
}
