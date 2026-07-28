import type { Server } from "node:http";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { paymentDepositSettings } from "@mi-bicla/db";
import { parseEnv } from "@mi-bicla/shared";
import { createApp } from "../../artifacts/api/src/app.js";
import {
  TEST_EMPLOYEE,
  TEST_OWNER,
  createTestDatabase,
  requireSafeTestDatabaseUrl,
  seedIntegrationUsers,
  truncateApplicationTables,
} from "./support/test-database.js";

const ORIGIN = "http://127.0.0.1:5173";
const FICTIONAL_ACCOUNT = "00000000000000000001";

type Session = { cookie: string; csrf: string };

let server: Server;
let apiDatabaseClient: ReturnType<typeof postgres>;
let baseUrl = "";

async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    session?: Session;
    origin?: string | false;
    csrf?: string | false;
  } = {},
) {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.origin !== false) headers.set("origin", options.origin ?? ORIGIN);
  if (options.session) headers.set("cookie", options.session.cookie);
  const csrf = options.csrf === false ? undefined : options.csrf ?? options.session?.csrf;
  if (csrf) headers.set("x-csrf-token", csrf);
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function login(
  credentials: { email: string; password: string } = {
    email: TEST_OWNER.email,
    password: TEST_OWNER.password,
  },
): Promise<Session> {
  const response = await request("/auth/login", {
    method: "POST",
    body: { email: credentials.email, password: credentials.password },
  });
  const body = (await response.json()) as {
    csrfToken: string;
    error?: { message?: string; fieldErrors?: unknown };
  };
  expect(response.status, JSON.stringify(body)).toBe(200);
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("El login no devolvió cookie de sesión.");
  return {
    cookie: setCookie.split(";")[0]!,
    csrf: body.csrfToken,
  };
}

beforeAll(async () => {
  const { db, client } = createTestDatabase();
  apiDatabaseClient = client;
  const env = parseEnv({
    ...process.env,
    DATABASE_URL: requireSafeTestDatabaseUrl(),
  });
  const app = createApp(env, db);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("No se pudo obtener el puerto de integración.");
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

beforeEach(async () => {
  await truncateApplicationTables();
  await seedIntegrationUsers();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await apiDatabaseClient.end();
});

describe("infraestructura PostgreSQL", () => {
  it("aplica todas las migraciones desde una base vacía", async () => {
    const { db, client } = createTestDatabase();
    try {
      const migrations = await db.execute<{ count: number }>(sql`
        select count(*)::int as count from drizzle.__drizzle_migrations
      `);
      const tables = await db.execute<{ name: string }>(sql`
        select table_name as name
        from information_schema.tables
        where table_schema = 'public'
      `);
      expect(migrations[0]?.count).toBe(8);
      expect(tables.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          "administrators",
          "customers",
          "payment_deposit_options",
          "workshop_orders",
          "workshop_service_catalog",
        ]),
      );
    } finally {
      await client.end();
    }
  });

  it("rechaza URLs que no sean bases locales de prueba", () => {
    expect(() =>
      requireSafeTestDatabaseUrl(
        "postgresql://fake:fake@fake.neon.tech/mi_bicla_production",
      ),
    ).toThrow();
    expect(() =>
      requireSafeTestDatabaseUrl(
        "postgresql://fake:fake@localhost/mi_bicla_production_test",
      ),
    ).toThrow();
    expect(() => requireSafeTestDatabaseUrl("")).toThrow();
  });
});

describe("autenticación y autorización", () => {
  it("acepta login válido, expone sesión y revoca al cerrar sesión", async () => {
    const session = await login();
    const current = await request("/auth/session", { session });
    expect(current.status).toBe(200);
    expect(await current.json()).toMatchObject({
      authenticated: true,
      administrator: { email: TEST_OWNER.email, role: "owner" },
    });

    const logout = await request("/auth/logout", {
      method: "POST",
      session,
    });
    expect(logout.status).toBe(204);
    expect((await request("/auth/session", { session })).status).toBe(401);
  });

  it("rechaza login inválido", async () => {
    const response = await request("/auth/login", {
      method: "POST",
      body: { email: TEST_OWNER.email, password: "Wrong-Password1!" },
    });
    expect(response.status).toBe(401);
  });

  it("exige origen y token CSRF en mutaciones autenticadas", async () => {
    const session = await login();
    const withoutOrigin = await request("/auth/logout", {
      method: "POST",
      session,
      origin: false,
    });
    expect(withoutOrigin.status).toBe(403);

    const withoutToken = await request("/auth/logout", {
      method: "POST",
      session,
      csrf: false,
    });
    expect(withoutToken.status).toBe(403);
  });

  it("niega acceso sin autenticación y aplica RBAC", async () => {
    expect((await request("/api/admin/customers")).status).toBe(401);

    const employee = await login(TEST_EMPLOYEE);
    const forbidden = await request("/api/admin/settings/deposits", {
      session: employee,
    });
    expect(forbidden.status).toBe(403);
  });
});

describe("clientes y depósitos", () => {
  it("crea y consulta un cliente", async () => {
    const session = await login();
    const created = await request("/api/admin/customers", {
      method: "POST",
      session,
      body: {
        firstName: "Cliente",
        lastName: "Integración",
        phone: "442 000 0000",
        email: "cliente@example.test",
        birthDate: null,
        notes: "Dato ficticio",
        status: "active",
      },
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { customer: { id: string } };

    const detail = await request(`/api/admin/customers/${body.customer.id}`, {
      session,
    });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      customer: {
        firstName: "Cliente",
        lastName: "Integración",
        phone: "+524420000000",
      },
    });
  });

  it("cifra un depósito, lo enmascara para administración y respeta su visibilidad pública", async () => {
    const session = await login();
    const created = await request("/api/admin/settings/deposits", {
      method: "POST",
      session,
      body: {
        displayName: "Cuenta ficticia de integración",
        bankName: "Banco de Pruebas",
        accountHolder: "Persona Ficticia",
        accountNumber: FICTIONAL_ACCOUNT,
        clabe: "",
        cardNumber: "",
        referenceText: "Referencia ficticia",
        instructions: "Solo para pruebas automatizadas",
        whatsappNumber: "",
        whatsappTemplate: "",
        showAccountNumber: true,
        showClabe: false,
        showCardNumber: false,
        showBank: true,
        showHolder: true,
        isActive: true,
        sortOrder: 0,
        clearAccountNumber: false,
        clearClabe: false,
        clearCardNumber: false,
      },
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      hasAccountNumber: true,
      maskedAccountNumber: "•••• 0001",
    });

    const { db, client } = createTestDatabase();
    try {
      const [stored] = await db.select().from(paymentDepositSettings).limit(1);
      expect(stored?.accountNumberEncrypted).toBeTruthy();
      expect(stored?.accountNumberEncrypted).not.toBe(FICTIONAL_ACCOUNT);
      expect(stored?.accountNumberEncrypted).not.toContain(FICTIONAL_ACCOUNT);
    } finally {
      await client.end();
    }

    const publicResponse = await request("/api/public/depositos");
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.json()).toMatchObject({
      items: [
        {
          displayName: "Cuenta ficticia de integración",
          accountNumber: FICTIONAL_ACCOUNT,
        },
      ],
    });
  });
});
