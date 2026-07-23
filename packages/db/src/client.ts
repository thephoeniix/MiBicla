import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as businessSchema from "./schema/business-settings.js";
export function createDatabase(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL es obligatoria");
  const client = postgres(url, { max: 10 });
  return {
    db: drizzle(client, { schema: { ...schema, ...businessSchema } }),
    client,
  };
}
