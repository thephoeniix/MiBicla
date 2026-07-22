import { eq } from "drizzle-orm";
import { ownerEnvironmentSchema } from "@mi-bicla/api-contract";
import { hashPassword, normalizeEmail } from "@mi-bicla/shared";
import { createDatabase } from "./client.js";
import { administrators, roles } from "./schema.js";
const env = ownerEnvironmentSchema.parse(process.env),
  email = normalizeEmail(env.OWNER_EMAIL),
  { db, client } = createDatabase();
let created = false;
await db.transaction(async (tx) => {
  const [owner] = await tx
    .select()
    .from(roles)
    .where(eq(roles.name, "owner"))
    .limit(1);
  if (!owner) throw new Error("Ejecuta db:seed antes de crear el owner.");
  const [existing] = await tx
    .select({ id: administrators.id })
    .from(administrators)
    .where(eq(administrators.emailNormalized, email))
    .limit(1);
  if (existing) return;
  await tx
    .insert(administrators)
    .values({
      roleId: owner.id,
      name: env.OWNER_NAME,
      email: env.OWNER_EMAIL.trim(),
      emailNormalized: email,
      passwordHash: await hashPassword(env.OWNER_PASSWORD),
    });
  created = true;
});
await client.end();
console.log(created ? "Owner creado." : "La cuenta ya existe; no se modificó.");
