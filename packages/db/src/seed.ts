import {
  PERMISSION_NAMES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
} from "@mi-bicla/shared";
import { createDatabase } from "./client.js";
import { permissions, rolePermissions, roles } from "./schema.js";
const { db, client } = createDatabase();
await db.transaction(async (tx) => {
  for (const name of ROLE_NAMES)
    await tx
      .insert(roles)
      .values({ name })
      .onConflictDoUpdate({
        target: roles.name,
        set: { updatedAt: new Date() },
      });
  for (const name of PERMISSION_NAMES)
    await tx.insert(permissions).values({ name }).onConflictDoNothing();
  const rs = await tx.select().from(roles),
    ps = await tx.select().from(permissions);
  for (const r of rs)
    for (const name of ROLE_PERMISSIONS[
      r.name as keyof typeof ROLE_PERMISSIONS
    ] ?? []) {
      const p = ps.find((x) => x.name === name);
      if (p)
        await tx
          .insert(rolePermissions)
          .values({ roleId: r.id, permissionId: p.id })
          .onConflictDoNothing();
    }
});
await client.end();
console.log("Seeds aplicados sin eliminar asignaciones existentes.");
