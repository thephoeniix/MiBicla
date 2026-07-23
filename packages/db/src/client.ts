import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as businessSchema from "./schema/business-settings.js";
import * as phase2Schema from "./schema/phase-2.js";
import * as workshopSchema from "./schema/workshop.js";
export function createDatabase(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL es obligatoria");
  const client = postgres(url, { max: 10 });
  return {
    db: drizzle(client, {
      schema: {
        ...schema,
        ...businessSchema,
        ...phase2Schema,
        ...workshopSchema,
      },
    }),
    client,
  };
}
