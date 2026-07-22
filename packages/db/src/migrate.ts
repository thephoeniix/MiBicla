import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client.js";
const { db, client } = createDatabase();
await migrate(db, {
  migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
});
await client.end();
console.log("Migraciones aplicadas.");
