import type { Server } from "node:http";
import type postgres from "postgres";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  auditLogs,
  customerAuthTokens,
  customerCredentials,
  customerSessions,
  customers,
  paymentDepositSettings,
  rateLimits,
} from "@mi-bicla/db";
import { hashSessionToken, parseEnv, verifyPassword } from "@mi-bicla/shared";
import { createApp } from "../../artifacts/api/src/app.js";
import { CustomerAuthService } from "../../artifacts/api/src/services/customer-auth.service.js";
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
type CustomerSession = Session;

let server: Server;
let apiDatabaseClient: ReturnType<typeof postgres>;
let baseUrl = "";

function verificationBarrier(result = true) {
  let announceStarted!: () => void;
  let releaseVerification!: () => void;
  const started = new Promise<void>((resolve) => {
    announceStarted = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseVerification = resolve;
  });
  return {
    started,
    release: releaseVerification,
    verify: vi.fn(async () => {
      announceStarted();
      await released;
      return result;
    }),
  };
}

function multiVerificationBarrier(expectedCalls: number, result = false) {
  let arrived = 0;
  let announceAllStarted!: () => void;
  let releaseAll!: () => void;
  const allStarted = new Promise<void>((resolve) => {
    announceAllStarted = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseAll = resolve;
  });
  return {
    allStarted,
    release: releaseAll,
    verify: vi.fn(async () => {
      arrived += 1;
      if (arrived === expectedCalls) announceAllStarted();
      await released;
      return result;
    }),
  };
}

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

async function createCustomer(admin: Session, suffix = "uno") {
  const response = await request("/api/admin/customers", {
    method: "POST",
    session: admin,
    body: {
      firstName: "Cliente",
      lastName: `Ficticio ${suffix}`,
      phone: suffix === "dos" ? "442 000 0002" : "442 000 0001",
      email: `cliente.${suffix}@example.test`,
      birthDate: null,
      notes: "Fixture ficticio",
      status: "active",
    },
  });
  expect(response.status).toBe(201);
  return (await response.json()) as {
    customer: { id: string; phone: string };
  };
}

async function generateCustomerLink(
  admin: Session,
  customerId: string,
  purpose: "activation" | "recovery",
) {
  const response = await request(
    `/api/admin/customers/${customerId}/auth/${purpose}`,
    { method: "POST", session: admin },
  );
  expect(response.status).toBe(201);
  const body = (await response.json()) as {
    link: string;
    whatsappUrl: string;
  };
  const token = new URL(body.link).searchParams.get("token");
  if (!token) throw new Error("La respuesta no incluyó token.");
  return { ...body, token };
}

async function activateCustomer(admin: Session, customerId: string) {
  const link = await generateCustomerLink(admin, customerId, "activation");
  const password = "Customer-Fictional-Password1!";
  const response = await request("/api/customer/auth/activate", {
    method: "POST",
    body: { token: link.token, password },
  });
  expect(response.status).toBe(204);
  return { password, ...link };
}

async function customerLogin(
  phone: string,
  password: string,
): Promise<CustomerSession> {
  const response = await request("/api/customer/auth/login", {
    method: "POST",
    body: { phone, password },
  });
  const body = (await response.json()) as { csrfToken: string };
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("No se recibió cookie de cliente.");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Lax");
  expect(setCookie).not.toContain("mb_session=");
  return { cookie: setCookie.split(";")[0]!, csrf: body.csrfToken };
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
      expect(migrations[0]?.count).toBe(9);
      expect(tables.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          "administrators",
          "customers",
          "payment_deposit_options",
          "workshop_orders",
          "workshop_service_catalog",
          "customer_credentials",
          "customer_sessions",
          "customer_auth_tokens",
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

describe("autenticación de clientes", () => {
  it("ejecuta verificación criptográfica para cuenta existente e inexistente", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const { password } = await activateCustomer(admin, customer.id);
    const { db, client } = createTestDatabase();
    const verify = vi.fn(async () => true);
    const service = new CustomerAuthService(db, ORIGIN, {
      hash: vi.fn(async () => "unused"),
      verify,
      dummyHash: Promise.resolve("dummy-hash"),
    });
    try {
      expect(
        await service.authenticateAndCreateSession(customer.phone, password),
      ).toBeTruthy();
      expect(
        await service.authenticateAndCreateSession(
          "+524420000099",
          "Wrong-Password1!",
        ),
      ).toBeNull();
      expect(verify).toHaveBeenCalledTimes(2);
      expect(verify.mock.calls[1]?.[0]).toBe("dummy-hash");
    } finally {
      await client.end();
    }
  });

  it("no calcula Argon2 para tokens inválidos, vencidos o incompatibles", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const link = await generateCustomerLink(admin, customer.id, "activation");
    const { db, client } = createTestDatabase();
    const hash = vi.fn(async () => "should-not-be-used");
    const service = new CustomerAuthService(db, ORIGIN, {
      hash,
      verify: vi.fn(async () => false),
      dummyHash: Promise.resolve("dummy-hash"),
    });
    try {
      expect(
        await service.consumePasswordToken(
          "f".repeat(64),
          "Customer-Fictional-Password1!",
          "activation",
        ),
      ).toBeNull();
      await db
        .update(customerAuthTokens)
        .set({
          createdAt: new Date(Date.now() - 120_000),
          expiresAt: new Date(Date.now() - 60_000),
        })
        .where(eq(customerAuthTokens.tokenHash, hashSessionToken(link.token)));
      expect(
        await service.consumePasswordToken(
          link.token,
          "Customer-Fictional-Password1!",
          "activation",
        ),
      ).toBeNull();
      expect(hash).not.toHaveBeenCalled();
    } finally {
      await client.end();
    }
  });

  it("revierte el consumo del token si falla el hash de contraseña", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const link = await generateCustomerLink(admin, customer.id, "activation");
    const { db, client } = createTestDatabase();
    const service = new CustomerAuthService(db, ORIGIN, {
      hash: vi.fn(async () => {
        throw new Error("Fallo criptográfico ficticio");
      }),
      verify: vi.fn(async () => false),
      dummyHash: Promise.resolve("dummy-hash"),
    });
    try {
      await expect(
        service.consumePasswordToken(
          link.token,
          "Customer-Fictional-Password1!",
          "activation",
        ),
      ).rejects.toThrow("Fallo criptográfico ficticio");
      const [token] = await db
        .select()
        .from(customerAuthTokens)
        .where(eq(customerAuthTokens.tokenHash, hashSessionToken(link.token)));
      const [credential] = await db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id));
      expect(token?.consumedAt).toBeNull();
      expect(credential?.passwordHash).toBeNull();
      expect(credential?.status).toBe("pending");
    } finally {
      await client.end();
    }
  });

  it("impide que un login con hash anterior cree sesión después de recuperación", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const active = await activateCustomer(admin, customer.id);
    const recovery = await generateCustomerLink(
      admin,
      customer.id,
      "recovery",
    );
    const barrier = verificationBarrier();
    const { db, client } = createTestDatabase();
    const service = new CustomerAuthService(db, ORIGIN, {
      hash: vi.fn(async () => "unused"),
      verify: barrier.verify,
      dummyHash: Promise.resolve("dummy-hash"),
    });
    const loginAttempt = service.authenticateAndCreateSession(
      customer.phone,
      active.password,
    );
    await barrier.started;

    const newPassword = "Customer-Race-New-Password2!";
    expect(
      (
        await request("/api/customer/auth/recovery/reset", {
          method: "POST",
          body: { token: recovery.token, password: newPassword },
        })
      ).status,
    ).toBe(204);
    barrier.release();
    expect(await loginAttempt).toBeNull();
    try {
      const activeSessions = await db
        .select()
        .from(customerSessions)
        .where(isNull(customerSessions.revokedAt));
      expect(activeSessions).toHaveLength(0);
    } finally {
      await client.end();
    }
    expect((await customerLogin(customer.phone, newPassword)).cookie).toContain(
      "mb_customer_session=",
    );
  });

  it.each(["disabled", "phone", "inactive", "deleted"] as const)(
    "no crea sesión si cambia %s durante la verificación",
    async (change) => {
      const admin = await login();
      const { customer } = await createCustomer(admin);
      const active = await activateCustomer(admin, customer.id);
      const barrier = verificationBarrier();
      const { db, client } = createTestDatabase();
      const service = new CustomerAuthService(db, ORIGIN, {
        hash: vi.fn(async () => "unused"),
        verify: barrier.verify,
        dummyHash: Promise.resolve("dummy-hash"),
      });
      const attempt = service.authenticateAndCreateSession(
        customer.phone,
        active.password,
      );
      await barrier.started;

      if (change === "disabled")
        await db
          .update(customerCredentials)
          .set({ status: "disabled" })
          .where(eq(customerCredentials.customerId, customer.id));
      if (change === "phone")
        await db
          .update(customers)
          .set({ phone: "+524420000004" })
          .where(eq(customers.id, customer.id));
      if (change === "inactive")
        await db
          .update(customers)
          .set({ status: "inactive" })
          .where(eq(customers.id, customer.id));
      if (change === "deleted")
        await db
          .update(customers)
          .set({ deletedAt: new Date() })
          .where(eq(customers.id, customer.id));

      barrier.release();
      expect(await attempt).toBeNull();
      try {
        const sessions = await db.select().from(customerSessions);
        expect(sessions).toHaveLength(0);
      } finally {
        await client.end();
      }
    },
  );

  it("genera activación administrativa, guarda sólo hash y prepara WhatsApp normalizado", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const link = await generateCustomerLink(admin, customer.id, "activation");
    const { db, client } = createTestDatabase();
    try {
      const [stored] = await db.select().from(customerAuthTokens).limit(1);
      expect(stored?.tokenHash).toBe(hashSessionToken(link.token));
      expect(stored?.tokenHash).not.toBe(link.token);
      const whatsapp = new URL(link.whatsappUrl);
      expect(whatsapp.hostname).toBe("wa.me");
      expect(whatsapp.pathname).toBe("/524420000001");
      expect([...whatsapp.searchParams.keys()]).toEqual(["text"]);
      expect(whatsapp.searchParams.get("text")).toContain(link.link);

      const entries = await db.select().from(auditLogs);
      expect(JSON.stringify(entries)).not.toContain(link.token);
    } finally {
      await client.end();
    }
  });

  it("valida, consume una vez y almacena la contraseña como hash", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const link = await generateCustomerLink(admin, customer.id, "activation");
    const validation = await request("/api/customer/auth/activation/validate", {
      method: "POST",
      body: { token: link.token },
    });
    expect(await validation.json()).toEqual({ valid: true });

    const password = "Customer-Fictional-Password1!";
    expect(
      (
        await request("/api/customer/auth/activate", {
          method: "POST",
          body: { token: link.token, password },
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await request("/api/customer/auth/activate", {
          method: "POST",
          body: { token: link.token, password },
        })
      ).status,
    ).toBe(401);

    const { db, client } = createTestDatabase();
    try {
      const [credential] = await db.select().from(customerCredentials).limit(1);
      expect(credential?.passwordHash).not.toBe(password);
      expect(await verifyPassword(credential!.passwordHash!, password)).toBe(
        true,
      );
    } finally {
      await client.end();
    }
  });

  it("rechaza token vencido y permite un solo ganador concurrente", async () => {
    const admin = await login();
    const first = await createCustomer(admin);
    const expired = await generateCustomerLink(
      admin,
      first.customer.id,
      "activation",
    );
    const { db, client } = createTestDatabase();
    try {
      await db
        .update(customerAuthTokens)
        .set({
          createdAt: new Date(Date.now() - 120_000),
          expiresAt: new Date(Date.now() - 60_000),
        })
        .where(eq(customerAuthTokens.tokenHash, hashSessionToken(expired.token)));
    } finally {
      await client.end();
    }
    expect(
      (
        await request("/api/customer/auth/activate", {
          method: "POST",
          body: {
            token: expired.token,
            password: "Customer-Fictional-Password1!",
          },
        })
      ).status,
    ).toBe(401);

    const second = await createCustomer(admin, "dos");
    const current = await generateCustomerLink(
      admin,
      second.customer.id,
      "activation",
    );
    const statuses = await Promise.all(
      [1, 2].map(async () =>
        (
          await request("/api/customer/auth/activate", {
            method: "POST",
            body: {
              token: current.token,
              password: "Customer-Fictional-Password1!",
            },
          })
        ).status,
      ),
    );
    expect(statuses.sort()).toEqual([204, 401]);
  });

  it("aplica rate limit separado sin persistir el token original", async () => {
    const token = "e".repeat(64);
    const password = "Customer-Fictional-Password1!";
    const paths = [
      {
        path: "/api/customer/auth/activation/validate",
        body: { token },
      },
      {
        path: "/api/customer/auth/activate",
        body: { token, password },
      },
      {
        path: "/api/customer/auth/recovery/reset",
        body: { token, password },
      },
    ];
    for (const entry of paths) {
      let last: Response | undefined;
      for (let attempt = 0; attempt < 6; attempt++)
        last = await request(entry.path, {
          method: "POST",
          body: entry.body,
        });
      expect(last?.status).toBe(429);
    }
    const { db, client } = createTestDatabase();
    try {
      const limits = await db.select().from(rateLimits);
      const serialized = JSON.stringify(limits);
      expect(serialized).not.toContain(token);
      expect(serialized).not.toContain(hashSessionToken(token));
      const audits = await db.select().from(auditLogs);
      expect(JSON.stringify(audits)).not.toContain(token);
    } finally {
      await client.end();
    }
  });

  it("rechaza activación y recuperación cuando la credencial está deshabilitada", async () => {
    const admin = await login();
    const first = await createCustomer(admin);
    const activation = await generateCustomerLink(
      admin,
      first.customer.id,
      "activation",
    );
    const { db, client } = createTestDatabase();
    try {
      await db
        .update(customerCredentials)
        .set({ status: "disabled" })
        .where(eq(customerCredentials.customerId, first.customer.id));
    } finally {
      await client.end();
    }
    expect(
      (
        await request("/api/customer/auth/activate", {
          method: "POST",
          body: {
            token: activation.token,
            password: "Customer-Fictional-Password1!",
          },
        })
      ).status,
    ).toBe(401);

    const second = await createCustomer(admin, "dos");
    const active = await activateCustomer(admin, second.customer.id);
    const recovery = await generateCustomerLink(
      admin,
      second.customer.id,
      "recovery",
    );
    const database = createTestDatabase();
    try {
      await database.db
        .update(customerCredentials)
        .set({ status: "disabled" })
        .where(eq(customerCredentials.customerId, second.customer.id));
    } finally {
      await database.client.end();
    }
    expect(
      (
        await request("/api/customer/auth/recovery/reset", {
          method: "POST",
          body: { token: recovery.token, password: active.password },
        })
      ).status,
    ).toBe(401);
  });

  it("cuenta fallos concurrentes sin pérdida y no prolonga el bloqueo", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    await activateCustomer(admin, customer.id);
    const { db, client } = createTestDatabase();
    const service = new CustomerAuthService(db, ORIGIN, {
      hash: vi.fn(async () => "unused"),
      verify: vi.fn(async () => false),
      dummyHash: Promise.resolve("dummy-hash"),
    });
    try {
      await Promise.all(
        Array.from({ length: 5 }, () =>
          service.authenticateAndCreateSession(
            customer.phone,
            "Wrong-Password1!",
          ),
        ),
      );
      const [locked] = await db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id));
      expect(locked?.failedLoginCount).toBe(5);
      expect(locked?.lockedUntil).toBeInstanceOf(Date);
      const originalLock = locked!.lockedUntil!.getTime();

      await Promise.all(
        Array.from({ length: 3 }, () =>
          service.authenticateAndCreateSession(
            customer.phone,
            "Wrong-Password1!",
          ),
        ),
      );
      const [after] = await db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id));
      expect(after?.failedLoginCount).toBe(5);
      expect(after?.lockedUntil?.getTime()).toBe(originalLock);
    } finally {
      await client.end();
    }
  });

  it("inicia una nueva ventana y vuelve a bloquear después de vencer el bloqueo", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    await activateCustomer(admin, customer.id);
    const { db, client } = createTestDatabase();
    const service = new CustomerAuthService(db, ORIGIN, {
      hash: vi.fn(async () => "unused"),
      verify: vi.fn(async () => false),
      dummyHash: Promise.resolve("dummy-hash"),
    });
    try {
      await Promise.all(
        Array.from({ length: 5 }, () =>
          service.authenticateAndCreateSession(
            customer.phone,
            "Wrong-Password1!",
          ),
        ),
      );
      const [firstLock] = await db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id));
      expect(firstLock?.failedLoginCount).toBe(5);
      expect(firstLock?.lockedUntil).toBeInstanceOf(Date);

      await db
        .update(customerCredentials)
        .set({ lockedUntil: new Date(Date.now() - 1_000) })
        .where(eq(customerCredentials.customerId, customer.id));
      await service.authenticateAndCreateSession(
        customer.phone,
        "Wrong-Password1!",
      );
      const [newWindow] = await db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id));
      expect(newWindow?.failedLoginCount).toBe(1);
      expect(newWindow?.lockedUntil).toBeNull();

      await Promise.all(
        Array.from({ length: 4 }, () =>
          service.authenticateAndCreateSession(
            customer.phone,
            "Wrong-Password1!",
          ),
        ),
      );
      const [secondLock] = await db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id));
      expect(secondLock?.failedLoginCount).toBe(5);
      expect(secondLock?.lockedUntil).toBeInstanceOf(Date);
      const secondExpiration = secondLock!.lockedUntil!.getTime();

      await Promise.all(
        Array.from({ length: 3 }, () =>
          service.authenticateAndCreateSession(
            customer.phone,
            "Wrong-Password1!",
          ),
        ),
      );
      const [unchanged] = await db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id));
      expect(unchanged?.failedLoginCount).toBe(5);
      expect(unchanged?.lockedUntil?.getTime()).toBe(secondExpiration);
    } finally {
      await client.end();
    }
  });

  it("descarta fallos iniciados con el hash anterior después de recuperación", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const active = await activateCustomer(admin, customer.id);
    const recovery = await generateCustomerLink(
      admin,
      customer.id,
      "recovery",
    );
    const attempts = 5;
    const barrier = multiVerificationBarrier(attempts);
    const { db, client } = createTestDatabase();
    const service = new CustomerAuthService(db, ORIGIN, {
      hash: vi.fn(async () => "unused"),
      verify: barrier.verify,
      dummyHash: Promise.resolve("dummy-hash"),
    });
    const staleAttempts = Array.from({ length: attempts }, () =>
      service.authenticateAndCreateSession(
        customer.phone,
        "Wrong-Password1!",
      ),
    );
    await barrier.allStarted;

    const newPassword = "Customer-Recovered-Password3!";
    expect(
      (
        await request("/api/customer/auth/recovery/reset", {
          method: "POST",
          body: { token: recovery.token, password: newPassword },
        })
      ).status,
    ).toBe(204);
    const [afterRecovery] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.customerId, customer.id));
    expect(afterRecovery?.failedLoginCount).toBe(0);
    expect(afterRecovery?.lockedUntil).toBeNull();

    barrier.release();
    expect(await Promise.all(staleAttempts)).toEqual(
      Array.from({ length: attempts }, () => null),
    );
    try {
      const [afterStale] = await db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id));
      const sessions = await db
        .select()
        .from(customerSessions)
        .where(isNull(customerSessions.revokedAt));
      expect(afterStale?.failedLoginCount).toBe(0);
      expect(afterStale?.lockedUntil).toBeNull();
      expect(sessions).toHaveLength(0);
    } finally {
      await client.end();
    }
    expect((await customerLogin(customer.phone, newPassword)).cookie).toContain(
      "mb_customer_session=",
    );
    expect(active.password).not.toBe(newPassword);
  });

  it.each([
    "pending",
    "disabled",
    "inactive",
    "deleted",
    "phone",
    "blocked",
  ] as const)(
    "verifica ficticiamente pero no cuenta fallos para cuenta no elegible: %s",
    async (condition) => {
      const admin = await login();
      const { customer } = await createCustomer(admin);
      await activateCustomer(admin, customer.id);
      const { db, client } = createTestDatabase();
      const verify = vi.fn(async () => false);
      const service = new CustomerAuthService(db, ORIGIN, {
        hash: vi.fn(async () => "unused"),
        verify,
        dummyHash: Promise.resolve("dummy-hash"),
      });
      try {
        if (condition === "pending" || condition === "disabled")
          await db
            .update(customerCredentials)
            .set({ status: condition })
            .where(eq(customerCredentials.customerId, customer.id));
        if (condition === "inactive")
          await db
            .update(customers)
            .set({ status: "inactive" })
            .where(eq(customers.id, customer.id));
        if (condition === "deleted")
          await db
            .update(customers)
            .set({ deletedAt: new Date() })
            .where(eq(customers.id, customer.id));
        if (condition === "phone")
          await db
            .update(customers)
            .set({ phone: "+524420000005" })
            .where(eq(customers.id, customer.id));
        if (condition === "blocked")
          await db
            .update(customerCredentials)
            .set({
              failedLoginCount: 5,
              lockedUntil: new Date(Date.now() + 60_000),
            })
            .where(eq(customerCredentials.customerId, customer.id));

        const [before] = await db
          .select()
          .from(customerCredentials)
          .where(eq(customerCredentials.customerId, customer.id));
        expect(
          await service.authenticateAndCreateSession(
            customer.phone,
            "Wrong-Password1!",
          ),
        ).toBeNull();
        const [after] = await db
          .select()
          .from(customerCredentials)
          .where(eq(customerCredentials.customerId, customer.id));
        expect(verify).toHaveBeenCalledTimes(1);
        expect(after?.failedLoginCount).toBe(before?.failedLoginCount);
        expect(after?.lockedUntil?.getTime()).toBe(
          before?.lockedUntil?.getTime(),
        );
      } finally {
        await client.end();
      }
    },
  );

  it("serializa enlaces concurrentes y deja solamente el último vigente", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const create = () =>
      generateCustomerLink(
        admin,
        customer.id,
        "activation",
      );
    const generated = await Promise.all([create(), create()]);
    expect(generated).toHaveLength(2);
    const { db, client } = createTestDatabase();
    try {
      const active = await db
        .select()
        .from(customerAuthTokens)
        .where(
          and(
            eq(customerAuthTokens.purpose, "activation"),
            isNull(customerAuthTokens.consumedAt),
            isNull(customerAuthTokens.revokedAt),
          ),
        );
      expect(active).toHaveLength(1);
      const allTokens = await db
        .select()
        .from(customerAuthTokens)
        .where(eq(customerAuthTokens.purpose, "activation"));
      const latest = [...allTokens].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )[0];
      expect(active[0]?.tokenHash).toBe(
        latest?.tokenHash,
      );
      const validity = await Promise.all(
        generated.map(async ({ token }) => {
          const response = await request(
            "/api/customer/auth/activation/validate",
            { method: "POST", body: { token } },
          );
          return (await response.json()) as { valid: boolean };
        }),
      );
      expect(validity.filter(({ valid }) => valid)).toHaveLength(1);
    } finally {
      await client.end();
    }
  });

  it("invalida sesión, login anterior y recuperación cuando cambia el teléfono", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const active = await activateCustomer(admin, customer.id);
    const session = await customerLogin(customer.phone, active.password);
    const { db, client } = createTestDatabase();
    try {
      await db
        .update(customers)
        .set({ phone: "+524420000003" })
        .where(eq(customers.id, customer.id));
    } finally {
      await client.end();
    }
    expect(
      (
        await request("/api/customer/auth/login", {
          method: "POST",
          body: { phone: customer.phone, password: active.password },
        })
      ).status,
    ).toBe(401);
    expect(
      (await request("/api/customer/session", { session })).status,
    ).toBe(401);
    expect(
      (
        await request(
          `/api/admin/customers/${customer.id}/auth/recovery`,
          { method: "POST", session: admin },
        )
      ).status,
    ).toBe(409);
    const database = createTestDatabase();
    try {
      const [credential] = await database.db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id));
      expect(credential?.status).toBe("disabled");
    } finally {
      await database.client.end();
    }
  });

  it("crea cookie y CSRF propios, mantiene sesiones aisladas y limita /me al cliente autenticado", async () => {
    const admin = await login();
    const first = await createCustomer(admin);
    const second = await createCustomer(admin, "dos");
    const { password } = await activateCustomer(admin, first.customer.id);
    const customerSession = await customerLogin(first.customer.phone, password);
    expect(customerSession.cookie).toMatch(/^mb_customer_session=/);

    expect(
      (await request("/api/customer/session", { session: admin })).status,
    ).toBe(401);
    expect(
      (
        await request("/auth/session", {
          session: customerSession,
        })
      ).status,
    ).toBe(401);
    const me = await request(`/api/customer/me?customerId=${second.customer.id}`, {
      session: customerSession,
    });
    expect(await me.json()).toMatchObject({ id: first.customer.id });

    expect(
      (
        await request("/api/customer/auth/logout", {
          method: "POST",
          session: customerSession,
          csrf: false,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/api/customer/auth/logout", {
          method: "POST",
          session: customerSession,
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await request("/api/customer/session", {
          session: customerSession,
        })
      ).status,
    ).toBe(401);
  });

  it("usa respuesta genérica, bloquea intentos y aplica rate limit", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const { password } = await activateCustomer(admin, customer.id);
    const nonexistent = await request("/api/customer/auth/login", {
      method: "POST",
      body: { phone: "4420000099", password: "Wrong-Password1!" },
    });
    const incorrect = await request("/api/customer/auth/login", {
      method: "POST",
      body: { phone: customer.phone, password: "Wrong-Password1!" },
    });
    expect((await nonexistent.json()).error.message).toBe(
      (await incorrect.json()).error.message,
    );
    for (let attempt = 0; attempt < 5; attempt++)
      await request("/api/customer/auth/login", {
        method: "POST",
        body: { phone: customer.phone, password: "Wrong-Password1!" },
      });
    const limited = await request("/api/customer/auth/login", {
      method: "POST",
      body: { phone: customer.phone, password },
    });
    expect(limited.status).toBe(429);

    const { db, client } = createTestDatabase();
    try {
      await db.delete(rateLimits);
      await request("/api/customer/auth/login", {
        method: "POST",
        body: { phone: customer.phone, password: "Wrong-Password1!" },
      });
      const [credential] = await db
        .select()
        .from(customerCredentials)
        .limit(1);
      expect(credential?.lockedUntil).toBeInstanceOf(Date);
      await db.delete(rateLimits);
    } finally {
      await client.end();
    }
    expect(
      (
        await request("/api/customer/auth/login", {
          method: "POST",
          body: { phone: customer.phone, password },
        })
      ).status,
    ).toBe(401);
  });

  it("recuperación revoca sesiones previas y clientes inactivos no autentican", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const active = await activateCustomer(admin, customer.id);
    const oldSession = await customerLogin(customer.phone, active.password);
    const recovery = await generateCustomerLink(
      admin,
      customer.id,
      "recovery",
    );
    const newPassword = "Customer-New-Fictional-Password2!";
    expect(
      (
        await request("/api/customer/auth/recovery/reset", {
          method: "POST",
          body: { token: recovery.token, password: newPassword },
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await request("/api/customer/auth/recovery/reset", {
          method: "POST",
          body: { token: recovery.token, password: newPassword },
        })
      ).status,
    ).toBe(401);
    expect(
      (await request("/api/customer/session", { session: oldSession })).status,
    ).toBe(401);
    expect((await customerLogin(customer.phone, newPassword)).cookie).toContain(
      "mb_customer_session=",
    );

    const { db, client } = createTestDatabase();
    try {
      await db
        .update(customers)
        .set({ status: "inactive" })
        .where(eq(customers.id, customer.id));
    } finally {
      await client.end();
    }
    expect(
      (
        await request("/api/customer/auth/login", {
          method: "POST",
          body: { phone: customer.phone, password: newPassword },
        })
      ).status,
    ).toBe(401);
  });

  it("no genera activación para clientes inactivos o eliminados", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const { db, client } = createTestDatabase();
    try {
      await db
        .update(customers)
        .set({ deletedAt: new Date() })
        .where(eq(customers.id, customer.id));
    } finally {
      await client.end();
    }
    expect(
      (
        await request(
          `/api/admin/customers/${customer.id}/auth/activation`,
          { method: "POST", session: admin },
        )
      ).status,
    ).toBe(409);
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
