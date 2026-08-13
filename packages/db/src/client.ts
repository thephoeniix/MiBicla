import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as businessSchema from "./schema/business-settings.js";
import * as phase2Schema from "./schema/phase-2.js";
import * as workshopSchema from "./schema/workshop.js";
import * as customerAuthSchema from "./schema/customer-auth.js";
import * as customerRegistrationSchema from "./schema/customer-registration.js";
export function createDatabase(
  url = process.env.DATABASE_URL,
  options: { max?: number } = {},
) {
  if (!url) throw new Error("DATABASE_URL es obligatoria");
  const client = postgres(url, {
    max: options.max ?? 10,
    connect_timeout: 10,
    idle_timeout: 30,
    max_lifetime: 60 * 30,
  });
  return {
    db: drizzle(client, {
      schema: {
        ...schema,
        ...businessSchema,
        ...phase2Schema,
        ...workshopSchema,
        ...customerAuthSchema,
        ...customerRegistrationSchema,
      },
    }),
    client,
  };
}
