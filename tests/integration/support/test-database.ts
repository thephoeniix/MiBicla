import { sql } from "drizzle-orm";
import {
  administrators,
  createDatabase,
  permissions,
  rolePermissions,
  roles,
} from "@mi-bicla/db";
import {
  PERMISSION_NAMES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  hashPassword,
  normalizeEmail,
} from "@mi-bicla/shared";

const LOCAL_TEST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PRODUCTION_MARKERS = /(neon|prod|production|live|primary)/i;

export function requireSafeTestDatabaseUrl(
  value = process.env.TEST_DATABASE_URL,
) {
  if (!value)
    throw new Error(
      "TEST_DATABASE_URL es obligatoria para las pruebas de integración.",
    );

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL debe ser una URL PostgreSQL válida.");
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("TEST_DATABASE_URL debe usar PostgreSQL.");
  if (!LOCAL_TEST_HOSTS.has(url.hostname))
    throw new Error(
      "TEST_DATABASE_URL solo puede apuntar a PostgreSQL local o al servicio desechable de CI.",
    );
  if (!/test/i.test(databaseName) || PRODUCTION_MARKERS.test(databaseName))
    throw new Error(
      "El nombre de TEST_DATABASE_URL debe incluir test y no parecer de producción.",
    );
  if (PRODUCTION_MARKERS.test(url.hostname))
    throw new Error("El host de TEST_DATABASE_URL parece de producción.");

  return value;
}

export function createTestDatabase() {
  return createDatabase(requireSafeTestDatabaseUrl());
}

export async function truncateApplicationTables() {
  const { db, client } = createTestDatabase();
  try {
    const tables = await db.execute<{ tablename: string }>(sql`
      select tablename
      from pg_tables
      where schemaname = 'public'
      order by tablename
    `);
    const names = tables.map(({ tablename }) => `"${tablename}"`);
    if (names.length)
      await client.unsafe(`TRUNCATE TABLE ${names.join(", ")} CASCADE`);
  } finally {
    await client.end();
  }
}

export const TEST_OWNER = {
  name: "Integration Owner",
  email: "owner.integration@example.test",
  password: "Integration-Owner-Password1!",
};

export const TEST_EMPLOYEE = {
  name: "Integration Employee",
  email: "employee.integration@example.test",
  password: "Integration-Employee-Password1!",
};

export async function seedIntegrationUsers() {
  const { db, client } = createTestDatabase();
  try {
    for (const name of ROLE_NAMES)
      await db.insert(roles).values({ name }).onConflictDoNothing();
    for (const name of PERMISSION_NAMES)
      await db.insert(permissions).values({ name }).onConflictDoNothing();

    const roleRows = await db.select().from(roles);
    const permissionRows = await db.select().from(permissions);
    for (const role of roleRows) {
      const names =
        ROLE_PERMISSIONS[role.name as keyof typeof ROLE_PERMISSIONS] ?? [];
      for (const name of names) {
        const permission = permissionRows.find((item) => item.name === name);
        if (permission)
          await db
            .insert(rolePermissions)
            .values({ roleId: role.id, permissionId: permission.id })
            .onConflictDoNothing();
      }
    }

    const ownerRole = roleRows.find((role) => role.name === "owner");
    const employeeRole = roleRows.find((role) => role.name === "employee");
    if (!ownerRole || !employeeRole)
      throw new Error("No se pudieron preparar los roles de integración.");

    await db.insert(administrators).values([
      {
        roleId: ownerRole.id,
        name: TEST_OWNER.name,
        email: TEST_OWNER.email,
        emailNormalized: normalizeEmail(TEST_OWNER.email),
        passwordHash: await hashPassword(TEST_OWNER.password),
      },
      {
        roleId: employeeRole.id,
        name: TEST_EMPLOYEE.name,
        email: TEST_EMPLOYEE.email,
        emailNormalized: normalizeEmail(TEST_EMPLOYEE.email),
        passwordHash: await hashPassword(TEST_EMPLOYEE.password),
      },
    ]);
  } finally {
    await client.end();
  }
}
