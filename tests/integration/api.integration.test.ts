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
  administrators,
  customerAuthTokens,
  customerCredentials,
  customerRegistrationRequests,
  customerSessions,
  customerBicycles,
  customerLoyaltyBalance,
  customerLoyaltyMovements,
  customerRewards,
  customers,
  paymentDepositSettings,
  rateLimits,
  roles,
  workshopCustomerUpdates,
  workshopOrders,
  workshopOrderServices,
  workshopStatusHistory,
} from "@mi-bicla/db";
import { hashPassword, hashSessionToken, parseEnv, verifyPassword } from "@mi-bicla/shared";
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
  it("expone salud de proceso y disponibilidad de PostgreSQL", async () => {
    const health = await request("/healthz", { origin: false });
    const ready = await request("/readyz", { origin: false });
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: "ready" });
  });

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
      expect(migrations[0]?.count).toBe(15);
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
          "customer_registration_requests",
          "customer_loyalty_movements",
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

describe("registro pendiente → verificación manual → activación (flujo transaccional)", () => {
  const minimalRegistration = (phone: string, overrides: Partial<{ firstName: string; lastName: string }> = {}) => ({
    firstName: overrides.firstName ?? "Registro",
    lastName: overrides.lastName ?? "Ficticio",
    phone,
  });

  async function registerAndApprove(phone: string, admin: Session) {
    const created = await request("/api/public/customer-registration", {
      method: "POST",
      body: minimalRegistration(phone),
    });
    expect(created.status).toBe(202);
    const { adminReviewUrl } = await created.json() as { adminReviewUrl: string };
    const reviewId = adminReviewUrl.split("/").at(-1)!;
    const approve = await request(`/api/admin/customer-registration-requests/${reviewId}/approve`, {
      method: "POST", session: admin,
    });
    expect(approve.status, JSON.stringify(await approve.clone().json())).toBe(200);
    return {
      reviewId,
      ...(await approve.json() as {
        customerId: string; expiresAt: string; link: string; whatsappUrl: string;
      }),
    };
  }

  it("el registro público acepta exclusivamente nombre, apellidos y teléfono", async () => {
    const withPassword = await request("/api/public/customer-registration", {
      method: "POST",
      body: { ...minimalRegistration("442 700 0001"), password: "Whatever-Password1!" },
    });
    expect(withPassword.status).toBe(400);

    const withEmail = await request("/api/public/customer-registration", {
      method: "POST",
      body: { ...minimalRegistration("442 700 0002"), email: "extra@example.test" },
    });
    expect(withEmail.status).toBe(400);

    const withUnexpectedField = await request("/api/public/customer-registration", {
      method: "POST",
      body: { ...minimalRegistration("442 700 0003"), unexpected: true },
    });
    expect(withUnexpectedField.status).toBe(400);

    const minimal = await request("/api/public/customer-registration", {
      method: "POST",
      body: minimalRegistration("442 700 0004"),
    });
    expect(minimal.status).toBe(202);
    expect(minimal.headers.get("set-cookie")).toBeNull();
  });

  it("create() no genera ni almacena contraseña en la solicitud", async () => {
    const created = await request("/api/public/customer-registration", {
      method: "POST",
      body: minimalRegistration("442 700 0011"),
    });
    const { adminReviewUrl } = await created.json() as { adminReviewUrl: string };
    const reviewId = adminReviewUrl.split("/").at(-1)!;
    const { db, client } = createTestDatabase();
    try {
      const [pending] = await db.select().from(customerRegistrationRequests)
        .where(eq(customerRegistrationRequests.reviewId, reviewId));
      expect(pending?.status).toBe("pending");
      expect(pending?.passwordHash).toBeNull();
    } finally { await client.end(); }
  });

  it("aprobar crea credencial pendiente + token de activación en una sola operación; sin sesión hasta activar de verdad", async () => {
    const phone = "442 700 0021";
    const admin = await login();
    const approved = await registerAndApprove(phone, admin);

    expect(approved.customerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(approved.link).toContain("/cuenta/activar?token=");
    expect(approved.whatsappUrl).toContain(`https://wa.me/52${phone.replace(/\D/g, "")}`);
    // La respuesta nunca expone hashes, contraseñas ni nombres de columna internos.
    expect(JSON.stringify(approved)).not.toMatch(/hash|password/i);

    // Sin contraseña todavía: nada permite iniciar sesión.
    expect((await request("/api/customer/auth/login", {
      method: "POST", body: { phone, password: "Whatever-Password1!" },
    })).status).toBe(401);

    const { db, client } = createTestDatabase();
    try {
      const [credential] = await db.select().from(customerCredentials)
        .where(eq(customerCredentials.customerId, approved.customerId));
      expect(credential?.status).toBe("pending");
      expect(credential?.passwordHash).toBeNull();
      const [tokenRow] = await db.select().from(customerAuthTokens)
        .where(eq(customerAuthTokens.credentialId, credential!.id));
      expect(tokenRow?.purpose).toBe("activation");
      expect(tokenRow?.consumedAt).toBeNull();
      expect(tokenRow?.revokedAt).toBeNull();
      const rawToken = new URL(approved.link).searchParams.get("token")!;
      expect(tokenRow?.tokenHash).toBe(hashSessionToken(rawToken));
      expect(tokenRow?.tokenHash).not.toBe(rawToken);
      // Vigencia de activación: ~24 horas, no 30 minutos.
      const hoursUntilExpiry =
        (new Date(approved.expiresAt).getTime() - Date.now()) / (60 * 60 * 1000);
      expect(hoursUntilExpiry).toBeGreaterThan(23.9);
      expect(hoursUntilExpiry).toBeLessThan(24.1);
    } finally { await client.end(); }

    const rawToken = new URL(approved.link).searchParams.get("token")!;
    const activate = await request("/api/customer/auth/activate", {
      method: "POST", body: { token: rawToken, password: "Fresh-Customer-Password1!" },
    });
    expect(activate.status).toBe(204);

    const session = await customerLogin(phone, "Fresh-Customer-Password1!");
    expect(session.cookie).toContain("mb_customer_session=");
  });

  it("completa registro, revisión, WhatsApp, activación, login, tarjeta, bicicleta y orden", async () => {
    const phone = "442 700 0099";
    const password = "Production-Flow-Password1!";
    const admin = await login();

    const registration = await request("/api/public/customer-registration", {
      method: "POST",
      body: minimalRegistration(phone, { firstName: "Flujo", lastName: "Integral" }),
    });
    expect(registration.status).toBe(202);
    const { adminReviewUrl } = await registration.json() as { adminReviewUrl: string };
    const reviewId = adminReviewUrl.split("/").at(-1)!;

    const pending = await request("/api/admin/customer-registration-requests", { session: admin });
    expect((await pending.json()).map((item: { reviewId: string }) => item.reviewId)).toContain(reviewId);

    const approval = await request(`/api/admin/customer-registration-requests/${reviewId}/approve`, {
      method: "POST",
      session: admin,
    });
    expect(approval.status).toBe(200);
    const approved = await approval.json() as {
      customerId: string;
      link: string;
      whatsappUrl: string;
    };
    expect(approved.whatsappUrl).toContain(`https://wa.me/52${phone.replace(/\D/g, "")}`);

    const activationToken = new URL(approved.link).searchParams.get("token")!;
    expect((await request("/api/customer/auth/activate", {
      method: "POST",
      body: { token: activationToken, password },
    })).status).toBe(204);
    const customer = await customerLogin(phone, password);

    const loyalty = await request("/api/customer/loyalty", { session: customer });
    expect(loyalty.status).toBe(200);
    expect((await loyalty.json()).name).toBe("Flujo Integral");
    expect((await request("/api/customer/card-link", {
      method: "POST",
      session: customer,
    })).status).toBe(201);

    const bicycle = await request("/api/customer/bicycles", {
      method: "POST",
      session: customer,
      body: { nickname: "Bici integral", brand: "Trek", model: "Fuel EX", bikeType: "Montaña" },
    });
    expect(bicycle.status).toBe(201);
    const bike = await bicycle.json() as { id: string; customerId: string };
    expect(bike.customerId).toBe(approved.customerId);

    const workshopRequest = await request("/api/customer/workshop-requests", {
      method: "POST",
      session: customer,
      body: {
        bicycleId: bike.id,
        serviceName: "Servicio completo",
        problemDescription: "Validación integral de una solicitud de servicio.",
        preferredContactMethod: "whatsapp",
      },
    });
    expect(workshopRequest.status).toBe(202);
    const requestNumber = (await workshopRequest.json()).requestNumber as string;
    const adminRequests = await request("/api/admin/workshop/requests", { session: admin });
    const adminRequest = (await adminRequests.json()).find(
      (item: { id: string; requestNumber: string }) => item.requestNumber === requestNumber,
    );
    const conversion = await request(`/api/admin/workshop/requests/${adminRequest.id}/convert`, {
      method: "POST",
      session: admin,
      body: {},
    });
    expect(conversion.status).toBe(201);
    const order = (await conversion.json()).order as {
      id: string;
      orderNumber: string;
      customerId: string;
      bicycleId: string;
    };
    expect(order).toMatchObject({ customerId: approved.customerId, bicycleId: bike.id });

    expect((await request(`/api/admin/workshop/orders/${order.id}/updates`, {
      method: "POST",
      session: admin,
      body: {
        title: "Diagnóstico iniciado",
        message: "El taller comenzó la revisión.",
        progressPercent: 20,
        photoUrl: null,
        customerVisible: true,
      },
    })).status).toBe(201);
    const orders = await request("/api/customer/orders", { session: customer });
    expect((await orders.json()).map((item: { orderNumber: string }) => item.orderNumber)).toContain(order.orderNumber);
    const tracking = await request(`/api/customer/orders/${order.orderNumber}`, { session: customer });
    expect(tracking.status).toBe(200);
    expect(await tracking.json()).toMatchObject({
      updates: [{ title: "Diagnóstico iniciado", message: "El taller comenzó la revisión." }],
    });
  });

  it("el token de activación es de un solo uso — reutilizarlo falla de forma comprensible", async () => {
    const admin = await login();
    const approved = await registerAndApprove("442 700 0031", admin);
    const rawToken = new URL(approved.link).searchParams.get("token")!;
    const first = await request("/api/customer/auth/activate", {
      method: "POST", body: { token: rawToken, password: "Fresh-Customer-Password1!" },
    });
    expect(first.status).toBe(204);
    const reused = await request("/api/customer/auth/activate", {
      method: "POST", body: { token: rawToken, password: "Another-Password2!" },
    });
    expect(reused.status).toBe(401);
    const reusedBody = await reused.json() as { error: { message: string } };
    expect(reusedBody.error.message).not.toMatch(/hash|sql|stack/i);
  });

  it("regenerar el enlace invalida el anterior — el viejo deja de servir", async () => {
    const admin = await login();
    const approved = await registerAndApprove("442 700 0041", admin);
    const oldToken = new URL(approved.link).searchParams.get("token")!;

    const regenerated = await request(`/api/admin/customers/${approved.customerId}/auth/activation`, {
      method: "POST", session: admin,
    });
    expect(regenerated.status).toBe(201);
    const { link: newLink } = await regenerated.json() as { link: string };
    const newToken = new URL(newLink).searchParams.get("token")!;
    expect(newToken).not.toBe(oldToken);

    const withOldToken = await request("/api/customer/auth/activate", {
      method: "POST", body: { token: oldToken, password: "Old-Token-Password1!" },
    });
    expect(withOldToken.status).toBe(401);

    const withNewToken = await request("/api/customer/auth/activate", {
      method: "POST", body: { token: newToken, password: "New-Token-Password1!" },
    });
    expect(withNewToken.status).toBe(204);
  });

  it("doble clic en 'generar activación' no deja dos enlaces vigentes a la vez", async () => {
    const admin = await login();
    const approved = await registerAndApprove("442 700 0051", admin);
    const [first, second] = await Promise.all([
      request(`/api/admin/customers/${approved.customerId}/auth/activation`, { method: "POST", session: admin }),
      request(`/api/admin/customers/${approved.customerId}/auth/activation`, { method: "POST", session: admin }),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const { db, client } = createTestDatabase();
    try {
      const [credential] = await db.select().from(customerCredentials)
        .where(eq(customerCredentials.customerId, approved.customerId));
      const liveTokens = await db.select().from(customerAuthTokens).where(and(
        eq(customerAuthTokens.credentialId, credential!.id),
        eq(customerAuthTokens.purpose, "activation"),
        isNull(customerAuthTokens.consumedAt),
        isNull(customerAuthTokens.revokedAt),
      ));
      expect(liveTokens).toHaveLength(1);
    } finally { await client.end(); }
  });

  it("la vigencia de recuperación (15 min) es distinta de la de activación (24 h)", async () => {
    const admin = await login();
    const phone = "442 700 0061";
    const approved = await registerAndApprove(phone, admin);
    const rawToken = new URL(approved.link).searchParams.get("token")!;
    await request("/api/customer/auth/activate", {
      method: "POST", body: { token: rawToken, password: "Active-Account-Password1!" },
    });
    const recovery = await request(`/api/admin/customers/${approved.customerId}/auth/recovery`, {
      method: "POST", session: admin,
    });
    expect(recovery.status).toBe(201);
    const { expiresAt } = await recovery.json() as { expiresAt: string };
    const minutesUntilExpiry = (new Date(expiresAt).getTime() - Date.now()) / (60 * 1000);
    expect(minutesUntilExpiry).toBeGreaterThan(14.5);
    expect(minutesUntilExpiry).toBeLessThan(15.5);
  });

  it("prepara WhatsApp con teléfono, nombre y vigencia, pero no lo envía — el administrador debe pulsarlo", async () => {
    const admin = await login();
    const approved = await registerAndApprove("442 700 0071", admin);
    const url = new URL(approved.whatsappUrl);
    expect(url.hostname).toBe("wa.me");
    const message = decodeURIComponent(url.searchParams.get("text")!);
    expect(message).toContain("Registro");
    expect(message).toMatch(/vence|expira/i);
    expect(message).not.toMatch(/mensaje enviado/i);
  });

  it("ninguna respuesta (aprobar, generar, detalle de cliente) expone hashes, contraseñas o el token crudo previo", async () => {
    const admin = await login();
    const approved = await registerAndApprove("442 700 0081", admin);
    const detail = await request(`/api/admin/customers/${approved.customerId}`, { session: admin });
    expect(detail.status).toBe(200);
    const detailBody = await detail.json() as Record<string, unknown>;
    expect(JSON.stringify(detailBody)).not.toMatch(/passwordHash|tokenHash/i);
    expect(detailBody).toMatchObject({
      credentialStatus: "pending",
      hasActiveActivation: true,
    });
    expect(typeof detailBody.activationExpiresAt).toBe("string");
  });

  it("solicitud antigua con password_hash previo no lo copia a customer_credentials y lo limpia al aprobar", async () => {
    const admin = await login();
    const phone = "442 700 0091";
    const { db, client } = createTestDatabase();
    let reviewId = "";
    try {
      const legacyHash = await hashPassword("Legacy-Password-Should-Not-Work1!");
      const [inserted] = await db.insert(customerRegistrationRequests).values({
        reviewId: "a".repeat(64),
        publicReference: "MB-LEGACY01",
        firstName: "Legado",
        lastName: "Previo",
        phoneNormalized: "+52" + phone.replace(/\D/g, ""),
        passwordHash: legacyHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning({ reviewId: customerRegistrationRequests.reviewId });
      reviewId = inserted!.reviewId;
    } finally { await client.end(); }

    const approve = await request(`/api/admin/customer-registration-requests/${reviewId}/approve`, {
      method: "POST", session: admin,
    });
    expect(approve.status).toBe(200);
    const approved = await approve.json() as { customerId: string; link: string };

    const { db: db2, client: client2 } = createTestDatabase();
    try {
      const [request_] = await db2.select().from(customerRegistrationRequests)
        .where(eq(customerRegistrationRequests.reviewId, reviewId));
      expect(request_?.passwordHash).toBeNull();
      const [credential] = await db2.select().from(customerCredentials)
        .where(eq(customerCredentials.customerId, approved.customerId));
      expect(credential?.passwordHash).toBeNull();
    } finally { await client2.end(); }

    expect((await request("/api/customer/auth/login", {
      method: "POST",
      body: { phone, password: "Legacy-Password-Should-Not-Work1!" },
    })).status).toBe(401);

    const rawToken = new URL(approved.link).searchParams.get("token")!;
    expect((await request("/api/customer/auth/activate", {
      method: "POST", body: { token: rawToken, password: "Genuinely-New-Password1!" },
    })).status).toBe(204);
  });

  it("un teléfono que ya pertenece a un cliente sin credencial se vincula, sin duplicar al cliente", async () => {
    const admin = await login();
    const phone = "442 700 0101";
    const normalizedPhone = "+52" + phone.replace(/\D/g, "");
    const { db, client } = createTestDatabase();
    try {
      await db.insert(customers).values({
        firstName: "Existente", lastName: "SinCredencial", phone: normalizedPhone, status: "active",
      });
    } finally { await client.end(); }

    const approved = await registerAndApprove(phone, admin);

    const { db: db2, client: client2 } = createTestDatabase();
    try {
      const matches = await db2.select().from(customers).where(eq(customers.phone, normalizedPhone));
      expect(matches).toHaveLength(1);
      expect(matches[0]?.id).toBe(approved.customerId);
    } finally { await client2.end(); }
  });

  it("un teléfono que ya pertenece a una cuenta activa no se puede volver a aprobar (409, sin duplicar)", async () => {
    const admin = await login();
    const phone = "442 700 0111";
    const approved = await registerAndApprove(phone, admin);
    const rawToken = new URL(approved.link).searchParams.get("token")!;
    await request("/api/customer/auth/activate", {
      method: "POST", body: { token: rawToken, password: "Already-Active-Password1!" },
    });

    const secondRequest = await request("/api/public/customer-registration", {
      method: "POST", body: minimalRegistration(phone),
    });
    expect(secondRequest.status).toBe(202);
    const { adminReviewUrl } = await secondRequest.json() as { adminReviewUrl: string };
    const secondReviewId = adminReviewUrl.split("/").at(-1)!;
    const secondApprove = await request(`/api/admin/customer-registration-requests/${secondReviewId}/approve`, {
      method: "POST", session: admin,
    });
    expect(secondApprove.status).toBe(409);

    const { db, client } = createTestDatabase();
    try {
      const matches = await db.select().from(customers)
        .where(eq(customers.phone, "+52" + phone.replace(/\D/g, "")));
      expect(matches).toHaveLength(1);
    } finally { await client.end(); }
  });

  it("dos solicitudes simultáneas con el mismo teléfono no dejan dos pendientes a la vez", async () => {
    const phone = "442 700 0121";
    const [a, b] = await Promise.all([
      request("/api/public/customer-registration", { method: "POST", body: minimalRegistration(phone, { firstName: "Primera" }) }),
      request("/api/public/customer-registration", { method: "POST", body: minimalRegistration(phone, { firstName: "Segunda" }) }),
    ]);
    expect([a.status, b.status]).toEqual([202, 202]);
    const { db, client } = createTestDatabase();
    try {
      const pendingRows = await db.select().from(customerRegistrationRequests).where(and(
        eq(customerRegistrationRequests.phoneNormalized, "+52" + phone.replace(/\D/g, "")),
        eq(customerRegistrationRequests.status, "pending"),
      ));
      expect(pendingRows).toHaveLength(1);
    } finally { await client.end(); }
  });

  it("doble aprobación concurrente: solo una gana, la otra ve 409, sin estados parciales", async () => {
    const created = await request("/api/public/customer-registration", {
      method: "POST", body: minimalRegistration("442 700 0131"),
    });
    const { adminReviewUrl } = await created.json() as { adminReviewUrl: string };
    const reviewId = adminReviewUrl.split("/").at(-1)!;
    const admin = await login();
    const approvals = await Promise.all([
      request(`/api/admin/customer-registration-requests/${reviewId}/approve`, { method: "POST", session: admin }),
      request(`/api/admin/customer-registration-requests/${reviewId}/approve`, { method: "POST", session: admin }),
    ]);
    expect(approvals.map(({ status }) => status).sort()).toEqual([200, 409]);
    const winner = (await approvals[0]!.json()) as { customerId?: string };
    const { db, client } = createTestDatabase();
    try {
      // Nunca queda un cliente aprobado sin credencial, ni una credencial sin cliente.
      if (winner.customerId) {
        const [credential] = await db.select().from(customerCredentials)
          .where(eq(customerCredentials.customerId, winner.customerId));
        expect(credential).toBeDefined();
        expect(credential?.status).toBe("pending");
      }
      const customerRows = await db.select().from(customers)
        .where(eq(customers.phone, "+524427000131"));
      expect(customerRows).toHaveLength(1);
    } finally { await client.end(); }
  });

  it("reintentar tras una transacción fallida (solicitud vencida) no deja residuos y una solicitud nueva funciona normalmente", async () => {
    const admin = await login();
    const created = await request("/api/public/customer-registration", {
      method: "POST", body: minimalRegistration("442 700 0141"),
    });
    const { adminReviewUrl } = await created.json() as { adminReviewUrl: string };
    const reviewId = adminReviewUrl.split("/").at(-1)!;
    const { db, client } = createTestDatabase();
    try {
      await db.update(customerRegistrationRequests)
        .set({ createdAt: new Date(Date.now() - 2_000), expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(customerRegistrationRequests.reviewId, reviewId));
    } finally { await client.end(); }

    const failedApprove = await request(`/api/admin/customer-registration-requests/${reviewId}/approve`, {
      method: "POST", session: admin,
    });
    expect(failedApprove.status).toBe(409);

    const { db: db2, client: client2 } = createTestDatabase();
    try {
      const customersFromFailedAttempt = await db2.select().from(customers)
        .where(eq(customers.phone, "+524427000141"));
      expect(customersFromFailedAttempt).toHaveLength(0);
    } finally { await client2.end(); }

    // El sistema sigue sano: una solicitud nueva (otro teléfono) funciona de punta a punta.
    const retry = await registerAndApprove("442 700 0142", admin);
    expect(retry.customerId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("aplica RBAC y respeta el rechazo (sin activación)", async () => {
    const created = await request("/api/public/customer-registration", {
      method: "POST", body: minimalRegistration("442 700 0151"),
    });
    const { adminReviewUrl } = await created.json() as { adminReviewUrl: string };
    const reviewId = adminReviewUrl.split("/").at(-1)!;
    const employee = await login({ email: TEST_EMPLOYEE.email, password: TEST_EMPLOYEE.password });
    expect((await request(`/api/admin/customer-registration-requests/${reviewId}`, { session: employee })).status).toBe(403);
    const admin = await login();
    expect((await request(`/api/admin/customer-registration-requests/${reviewId}/reject`, {
      method: "POST", session: admin, body: { reason: "No coincide el remitente" },
    })).status).toBe(204);
    const { db, client } = createTestDatabase();
    try {
      const [rejected] = await db.select().from(customerRegistrationRequests)
        .where(eq(customerRegistrationRequests.reviewId, reviewId));
      expect(rejected?.status).toBe("rejected");
      expect(rejected?.passwordHash).toBeNull();
    } finally { await client.end(); }
    expect((await request(`/api/admin/customer-registration-requests/${reviewId}/approve`, {
      method: "POST", session: admin,
    })).status).toBe(409);
  });
});

describe("ajustes de fidelidad concurrentes", () => {
  it("serializa el saldo y conserva un movimiento por ajuste", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin, "concurrencia");
    const settings = await request("/api/admin/settings/loyalty", {
      method: "PUT",
      session: admin,
      body: {
        enabled: true,
        currency: "MXN",
        purchaseRules: [],
        rewardUnits: 100,
        rewardDiscountPercent: 10,
        rewardName: "Recompensa de prueba",
        rewardDescription: "Configuración para concurrencia",
        allowManualAdjustments: true,
        allowNegativeBalance: false,
      },
    });
    expect(settings.status).toBe(200);

    const adjustments = await Promise.all(
      Array.from({ length: 8 }, (_, index) => request(
        `/api/admin/customers/${customer.id}/loyalty-adjustments`,
        {
          method: "POST",
          session: admin,
          body: { units: 1, reason: `Ajuste concurrente ${index + 1}` },
        },
      )),
    );
    expect(adjustments.every(({ status }) => status === 200)).toBe(true);

    const { db, client } = createTestDatabase();
    try {
      const [balance] = await db.select().from(customerLoyaltyBalance)
        .where(eq(customerLoyaltyBalance.customerId, customer.id));
      const movements = await db.select().from(customerLoyaltyMovements)
        .where(eq(customerLoyaltyMovements.customerId, customer.id));
      expect(balance?.availableUnits).toBe(8);
      expect(movements).toHaveLength(8);
      expect(movements.reduce((sum, movement) => sum + movement.units, 0)).toBe(8);
    } finally {
      await client.end();
    }
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

  it("rota y restaura CSRF al consultar la sesión sin exponer cookie ni hashes", async () => {
    const admin = await login();
    const { customer } = await createCustomer(admin);
    const { password } = await activateCustomer(admin, customer.id);
    const customerSession = await customerLogin(customer.phone, password);
    const restored = await request("/api/customer/session", {
      session: customerSession,
    });
    expect(restored.status).toBe(200);
    const body = (await restored.json()) as {
      csrfToken: string;
      customer: { id: string };
    };
    expect(body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    expect(body.csrfToken).not.toBe(customerSession.csrf);
    expect(JSON.stringify(body)).not.toContain("tokenHash");
    expect(JSON.stringify(body)).not.toContain("mb_customer_session");
    expect(
      (
        await request("/api/customer/auth/logout", {
          method: "POST",
          session: customerSession,
          csrf: customerSession.csrf,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/api/customer/auth/logout", {
          method: "POST",
          session: customerSession,
          csrf: body.csrfToken,
        })
      ).status,
    ).toBe(204);
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
  }, 15_000);

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

  it("el portal expone solo puntos, bicicletas y órdenes pertenecientes a la sesión", async () => {
    const admin = await login();
    const first = await createCustomer(admin, "uno");
    const second = await createCustomer(admin, "dos");
    const firstActivation = await activateCustomer(admin, first.customer.id);
    const secondActivation = await activateCustomer(admin, second.customer.id);
    const firstSession = await customerLogin(first.customer.phone, firstActivation.password);
    const secondSession = await customerLogin(second.customer.phone, secondActivation.password);
    const { db, client } = createTestDatabase();
    let firstBikeId = "";
    let secondBikeId = "";
    try {
      await db.update(customerLoyaltyBalance).set({ availableUnits: 7, lifetimeUnits: 17 })
        .where(eq(customerLoyaltyBalance.customerId, first.customer.id));
      await db.update(customerLoyaltyBalance).set({ availableUnits: 99, lifetimeUnits: 99 })
        .where(eq(customerLoyaltyBalance.customerId, second.customer.id));
      await db.insert(customerRewards).values([
        { customerId: first.customer.id, rewardName: "Recompensa A", rewardDiscountPercent: "10", requiredUnits: 10 },
        { customerId: second.customer.id, rewardName: "Recompensa B", rewardDiscountPercent: "20", requiredUnits: 20 },
      ]);
      await db.insert(customerLoyaltyMovements).values({
        customerId: first.customer.id,
        units: 7,
        balanceAfter: 7,
        reason: "Compra participante",
      });
      const [firstBike, secondBike] = await db.insert(customerBicycles).values([
        { customerId: first.customer.id, nickname: "Bicicleta A", brand: "Marca A", status: "active" },
        { customerId: second.customer.id, nickname: "Bicicleta B", brand: "Marca B", status: "active" },
      ]).returning();
      firstBikeId = firstBike!.id;
      secondBikeId = secondBike!.id;
      const [firstOrder] = await db.insert(workshopOrders).values([
        {
          orderNumber: "OT-CLIENTE-A",
          customerId: first.customer.id,
          bicycleId: firstBikeId,
          problemDescription: "Servicio A",
          internalNotes: "NOTA INTERNA SECRETA",
          customerVisibleSummary: "Diagnóstico visible",
        },
        {
          orderNumber: "OT-CLIENTE-B",
          customerId: second.customer.id,
          bicycleId: secondBikeId,
          problemDescription: "Servicio B",
        },
        {
          orderNumber: "OT-DATO-INCONSISTENTE",
          customerId: first.customer.id,
          bicycleId: secondBikeId,
          problemDescription: "No debe exponerse",
        },
      ]).returning();
      await db.insert(workshopOrderServices).values([
        { workshopOrderId: firstOrder!.id, serviceName: "Servicio visible", isCustomerVisible: true },
        { workshopOrderId: firstOrder!.id, serviceName: "Servicio interno", isCustomerVisible: false },
      ]);
      await db.insert(workshopCustomerUpdates).values([
        { workshopOrderId: firstOrder!.id, title: "Avance visible", message: "Mensaje visible", customerVisible: true },
        { workshopOrderId: firstOrder!.id, title: "Avance interno", message: "Mensaje interno", customerVisible: false },
      ]);
      await db.insert(workshopStatusHistory).values([
        { workshopOrderId: firstOrder!.id, newStatus: "received", publicMessage: "Recibida", internalReason: "RAZÓN INTERNA", customerVisible: true },
        { workshopOrderId: firstOrder!.id, newStatus: "inspection", publicMessage: "Oculta", customerVisible: false },
      ]);
    } finally {
      await client.end();
    }

    for (const path of ["/api/customer/loyalty", "/api/customer/bicycles", "/api/customer/orders"]) {
      expect((await request(path)).status).toBe(401);
      expect((await request(path, { session: admin })).status).toBe(401);
    }

    const loyalty = await request(`/api/customer/loyalty?customerId=${second.customer.id}`, { session: firstSession });
    expect(loyalty.status).toBe(200);
    expect(loyalty.headers.get("cache-control")).toContain("no-store");
    const loyaltyBody = await loyalty.json();
    expect(loyaltyBody.balance.availableUnits).toBe(7);
    expect(loyaltyBody.memberCode).toBeUndefined();
    expect(loyaltyBody.rewards.map((reward: { rewardName: string }) => reward.rewardName)).toEqual(["Recompensa A"]);
    expect(loyaltyBody.movements[0].reason).toBe("Compra participante");

    const firstCardLink = await request("/api/customer/card-link", {
      method: "POST",
      session: firstSession,
    });
    expect(firstCardLink.status).toBe(201);
    const firstCardToken = new URL((await firstCardLink.json()).cardUrl).pathname.split("/").pop()!;
    const secondCardLink = await request("/api/customer/card-link", {
      method: "POST",
      session: firstSession,
    });
    const secondCardToken = new URL((await secondCardLink.json()).cardUrl).pathname.split("/").pop()!;
    expect((await request("/api/admin/customers/resolve-token", {
      method: "POST",
      session: admin,
      body: { token: firstCardToken },
    })).status).toBe(404);
    const scannedCard = await request("/api/admin/customers/resolve-token", {
      method: "POST",
      session: admin,
      body: { token: secondCardToken },
    });
    expect(scannedCard.status).toBe(200);
    expect((await scannedCard.json()).customer.id).toBe(first.customer.id);

    const bicycles = await request(`/api/customer/bicycles?customerId=${second.customer.id}`, { session: firstSession });
    expect((await bicycles.json()).map((bike: { id: string }) => bike.id)).toEqual([firstBikeId]);

    expect((await request("/api/customer/bicycles", {
      method: "POST",
      session: firstSession,
      csrf: false,
      body: { nickname: "Nueva bici" },
    })).status).toBe(403);
    const createdBike = await request("/api/customer/bicycles", {
      method: "POST",
      session: firstSession,
      body: { nickname: "Nueva bici", brand: "Trek", wheelSize: "29" },
    });
    expect(createdBike.status).toBe(201);
    const createdBikeBody = await createdBike.json();
    expect(createdBikeBody.customerId).toBe(first.customer.id);
    expect((await request(`/api/customer/bicycles/${secondBikeId}`, {
      method: "PATCH",
      session: firstSession,
      body: { nickname: "No autorizada" },
    })).status).toBe(404);

    expect((await request("/api/customer/profile", {
      method: "PATCH",
      session: firstSession,
      body: { firstName: "Cliente", lastName: "Actualizado", email: "nuevo@example.test", birthDate: null, phone: "+524420000099" },
    })).status).toBe(400);
    const profile = await request("/api/customer/profile", {
      method: "PATCH",
      session: firstSession,
      body: { firstName: "Cliente", lastName: "Actualizado", email: "nuevo@example.test", birthDate: null },
    });
    expect(profile.status).toBe(200);
    expect((await profile.json()).phone).toBe(first.customer.phone);

    expect((await request("/api/customer/workshop-requests", {
      method: "POST",
      session: firstSession,
      body: { bicycleId: secondBikeId, serviceName: "Servicio completo", problemDescription: "Solicitud con bicicleta ajena", preferredContactMethod: "whatsapp" },
    })).status).toBe(404);
    const ownRequest = await request("/api/customer/workshop-requests", {
      method: "POST",
      session: firstSession,
      body: { bicycleId: firstBikeId, serviceName: "Servicio completo", problemDescription: "Necesita ajuste y diagnóstico completo", preferredContactMethod: "whatsapp" },
    });
    expect(ownRequest.status).toBe(202);
    const ownRequestBody = await ownRequest.json();
    expect(ownRequestBody.requestNumber).toMatch(/^SOL-/);
    const listedRequests = await request("/api/customer/workshop-requests", { session: firstSession });
    expect((await listedRequests.json()).map((item: { requestNumber: string }) => item.requestNumber)).toContain(ownRequestBody.requestNumber);

    const adminRequests = await request("/api/admin/workshop/requests", { session: admin });
    const ownAdminRequest = (await adminRequests.json()).find(
      (item: { id: string; requestNumber: string }) => item.requestNumber === ownRequestBody.requestNumber,
    );
    const converted = await request(`/api/admin/workshop/requests/${ownAdminRequest.id}/convert`, {
      method: "POST",
      session: admin,
      body: {},
    });
    expect(converted.status).toBe(201);
    const convertedBody = await converted.json();
    expect(convertedBody.order).toMatchObject({
      customerId: first.customer.id,
      bicycleId: firstBikeId,
    });
    await request(`/api/admin/workshop/orders/${convertedBody.order.id}/parts`, {
      method: "POST",
      session: admin,
      body: {
        partName: "Cadena visible",
        brand: "Marca visible",
        sku: null,
        description: "Refacción publicada por el taller",
        quantity: 1,
        unitPriceCents: 45000,
        isCustomerVisible: true,
        status: "ordered",
      },
    });
    await request(`/api/admin/workshop/orders/${convertedBody.order.id}/updates`, {
      method: "POST",
      session: admin,
      body: {
        title: "Diagnóstico terminado",
        message: "La bicicleta está lista para reparación.",
        progressPercent: 35,
        photoUrl: null,
        customerVisible: true,
      },
    });

    const mismatchedCreation = await request("/api/admin/workshop/orders", {
      method: "POST",
      session: admin,
      body: {
        customerId: first.customer.id,
        bicycleId: secondBikeId,
        problemDescription: "Intento con bicicleta ajena",
        priority: "normal",
        discountCents: 0,
      },
    });
    expect(mismatchedCreation.status).not.toBe(201);

    const orders = await request(`/api/customer/orders?customerId=${second.customer.id}`, { session: firstSession });
    const orderBody = await orders.json();
    expect(orderBody.map((order: { orderNumber: string }) => order.orderNumber)).toEqual(
      expect.arrayContaining(["OT-CLIENTE-A", convertedBody.order.orderNumber]),
    );
    const convertedDetail = await request(
      `/api/customer/orders/${convertedBody.order.orderNumber}`,
      { session: firstSession },
    );
    expect(convertedDetail.status).toBe(200);
    expect(await convertedDetail.json()).toMatchObject({
      visibleParts: [{ partName: "Cadena visible", brand: "Marca visible", status: "ordered" }],
      updates: [{ title: "Diagnóstico terminado", message: "La bicicleta está lista para reparación." }],
    });

    const detail = await request("/api/customer/orders/OT-CLIENTE-A", { session: firstSession });
    expect(detail.status).toBe(200);
    const detailText = await detail.text();
    expect(detailText).toContain("Servicio visible");
    expect(detailText).toContain("Avance visible");
    expect(detailText).not.toMatch(/Servicio interno|Avance interno|NOTA INTERNA|RAZÓN INTERNA|unitPriceCents/);

    const foreign = await request("/api/customer/orders/OT-CLIENTE-B", { session: firstSession });
    const missing = await request("/api/customer/orders/OT-NO-EXISTE", { session: firstSession });
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect((await foreign.json()).error.code).toBe((await missing.json()).error.code);
    expect((await request("/api/customer/orders/OT-CLIENTE-B", { session: secondSession })).status).toBe(200);

    expect((await request("/api/customer/password", {
      method: "POST",
      session: firstSession,
      body: { currentPassword: "Incorrecta-Password1!", newPassword: "Customer-New-Portal2!" },
    })).status).toBe(400);
    expect((await request("/api/customer/password", {
      method: "POST",
      session: firstSession,
      body: { currentPassword: firstActivation.password, newPassword: "Customer-New-Portal2!" },
    })).status).toBe(204);
    expect((await request("/api/customer/session", { session: firstSession })).status).toBe(200);
  });
});

describe("autenticación y autorización", () => {
  it("acepta login válido, expone sesión y revoca al cerrar sesión", async () => {
    const session = await login();
    const current = await request("/auth/session", { session });
    expect(current.status).toBe(200);
    const currentBody = await current.json();
    expect(currentBody).toMatchObject({
      authenticated: true,
      administrator: { email: TEST_OWNER.email, role: "owner" },
    });
    expect(currentBody.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    expect(currentBody.csrfToken).not.toBe(session.csrf);

    const logout = await request("/auth/logout", {
      method: "POST",
      session,
      csrf: currentBody.csrfToken,
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

  it("permite al owner administrar cuentas sin exponer secretos", async () => {
    const owner = await login();
    expect((await request("/api/admin/administrators")).status).toBe(401);
    const employee = await login(TEST_EMPLOYEE);
    expect((await request("/api/admin/administrators", { session: employee })).status).toBe(403);

    const createdResponse = await request("/api/admin/administrators", {
      method: "POST",
      session: owner,
      body: {
        name: "Integration Admin",
        email: "Admin.Managed@Example.Test",
        password: "Managed-Admin-Password1!",
        role: "admin",
      },
    });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    expect(created).toMatchObject({ role: "admin", isActive: true });
    expect(JSON.stringify(created)).not.toMatch(/password|emailNormalized|failedLogin/i);

    const duplicate = await request("/api/admin/administrators", {
      method: "POST",
      session: owner,
      body: {
        name: "Duplicate",
        email: "admin.managed@example.test",
        password: "Managed-Admin-Password1!",
        role: "employee",
      },
    });
    expect(duplicate.status).toBe(409);

    const managedSession = await login({
      email: "admin.managed@example.test",
      password: "Managed-Admin-Password1!",
    });
    const roleChange = await request(`/api/admin/administrators/${created.id}/role`, {
      method: "PATCH",
      session: owner,
      body: { role: "employee" },
    });
    expect(roleChange.status).toBe(200);
    expect((await request("/auth/session", { session: managedSession })).status).toBe(401);

    const reset = await request(`/api/admin/administrators/${created.id}/password/reset`, {
      method: "POST",
      session: owner,
      body: { newPassword: "Managed-New-Password2!" },
    });
    expect(reset.status).toBe(200);
    expect(JSON.stringify(await reset.json())).not.toMatch(/password|hash/i);
    const { db } = createTestDatabase();
    const [stored] = await db
      .select({ passwordHash: administrators.passwordHash })
      .from(administrators)
      .where(eq(administrators.id, created.id))
      .limit(1);
    expect(await verifyPassword(stored!.passwordHash, "Managed-Admin-Password1!")).toBe(false);
    expect(await verifyPassword(stored!.passwordHash, "Managed-New-Password2!")).toBe(true);
    const newSession = await login({
      email: "admin.managed@example.test",
      password: "Managed-New-Password2!",
    });

    const status = await request(`/api/admin/administrators/${created.id}/status`, {
      method: "PATCH",
      session: owner,
      body: { isActive: false },
    });
    expect(status.status).toBe(200);
    expect((await request("/auth/session", { session: newSession })).status).toBe(401);
  });

  it("protege owners y la propia cuenta de acciones administrativas", async () => {
    const owner = await login();
    const { db } = createTestDatabase();
    const [ownerRow] = await db
      .select({ id: administrators.id })
      .from(administrators)
      .innerJoin(roles, eq(administrators.roleId, roles.id))
      .where(eq(roles.name, "owner"))
      .limit(1);
    expect(ownerRow).toBeDefined();
    for (const [path, body] of [
      [`/api/admin/administrators/${ownerRow!.id}/role`, { role: "admin" }],
      [`/api/admin/administrators/${ownerRow!.id}/status`, { isActive: false }],
      [`/api/admin/administrators/${ownerRow!.id}/password/reset`, { newPassword: "Owner-New-Password2!" }],
    ] as const) {
      const response = await request(path, {
        method: path.endsWith("reset") ? "POST" : "PATCH",
        session: owner,
        body,
      });
      expect(response.status).toBe(409);
    }
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
