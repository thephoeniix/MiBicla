import { and, eq, gt, isNull, sql } from "drizzle-orm";
import {
  customerAuthTokens,
  customerCredentials,
  customerSessions,
  customers,
  type createDatabase,
} from "@mi-bicla/db";
import {
  ACCOUNT_LOCK_ATTEMPTS,
  ACCOUNT_LOCK_MS,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  calculateSessionRenewal,
  generateCsrfToken,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "@mi-bicla/shared";
import type { CustomerAuthPurpose } from "@mi-bicla/api-contract";
import { issueCustomerAuthToken } from "./customer-auth-tokens.js";

type Db = ReturnType<typeof createDatabase>["db"];
const defaultPasswordCrypto = {
  hash: hashPassword,
  verify: verifyPassword,
  dummyHash: hashPassword("Customer-Dummy-Password1!"),
};
type PasswordCrypto = typeof defaultPasswordCrypto;
class TokenConsumptionConflictError extends Error {
  constructor() {
    super("CUSTOMER_AUTH_TOKEN_CONSUMPTION_CONFLICT");
  }
}

export class CustomerAuthService {
  constructor(
    private db: Db,
    private appBaseUrl: string,
    private passwordCrypto: PasswordCrypto = defaultPasswordCrypto,
  ) {}

  async generateLink(
    customerId: string,
    purpose: CustomerAuthPurpose,
    administratorId: string,
  ) {
    const generated = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${customerId}), hashtext(${purpose}))`,
      );
      const [customer] = await tx
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.id, customerId),
            eq(customers.status, "active"),
            isNull(customers.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (!customer) return null;
      let [row] = await tx
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.customerId, customer.id))
        .limit(1)
        .for("update");
      if (row?.status === "disabled") return null;
      if (purpose === "activation" && row?.status === "active") return null;
      if (purpose === "recovery" && (!row || row.status !== "active"))
        return null;
      if (
        purpose === "recovery" &&
        row &&
        row.phoneNormalized !== customer.phone
      ) {
        const now = new Date();
        await tx
          .update(customerCredentials)
          .set({ status: "disabled", updatedAt: now })
          .where(eq(customerCredentials.id, row.id));
        await tx
          .update(customerAuthTokens)
          .set({ revokedAt: now })
          .where(
            and(
              eq(customerAuthTokens.credentialId, row.id),
              isNull(customerAuthTokens.consumedAt),
              isNull(customerAuthTokens.revokedAt),
            ),
          );
        await tx
          .update(customerSessions)
          .set({ revokedAt: now, revokeReason: "phone_changed" })
          .where(
            and(
              eq(customerSessions.credentialId, row.id),
              isNull(customerSessions.revokedAt),
            ),
          );
        return null;
      }
      if (!row) {
        [row] = await tx
          .insert(customerCredentials)
          .values({
            customerId: customer.id,
            phoneNormalized: customer.phone,
          })
          .returning();
      } else if (
        purpose === "activation" &&
        row.phoneNormalized !== customer.phone
      ) {
        [row] = await tx
          .update(customerCredentials)
          .set({
            phoneNormalized: customer.phone,
            status: "pending",
            updatedAt: new Date(),
          })
          .where(eq(customerCredentials.id, row.id))
          .returning();
      }
      if (!row) return null;
      const { token, expiresAt } = await issueCustomerAuthToken(tx, {
        credentialId: row.id,
        purpose,
        administratorId,
      });
      return { credential: row, expiresAt, token };
    });
    if (!generated) return null;

    const page = purpose === "activation" ? "activar" : "recuperar";
    const link = new URL(`/cuenta/${page}`, this.appBaseUrl);
    link.searchParams.set("token", generated.token);
    const message =
      purpose === "activation"
        ? `Activa tu cuenta Mi Bicla: ${link.toString()}`
        : `Restablece tu contraseña Mi Bicla: ${link.toString()}`;
    const whatsappUrl = new URL(
      `https://wa.me/${generated.credential.phoneNormalized.replace(/\D/g, "")}`,
    );
    whatsappUrl.searchParams.set("text", message);
    return {
      expiresAt: generated.expiresAt,
      link: link.toString(),
      whatsappUrl: whatsappUrl.toString(),
    };
  }

  async validateToken(token: string, purpose: CustomerAuthPurpose) {
    const expectedStatus = purpose === "activation" ? "pending" : "active";
    const [row] = await this.db
      .select({ id: customerAuthTokens.id })
      .from(customerAuthTokens)
      .innerJoin(
        customerCredentials,
        eq(customerAuthTokens.credentialId, customerCredentials.id),
      )
      .innerJoin(customers, eq(customerCredentials.customerId, customers.id))
      .where(
        and(
          eq(customerAuthTokens.tokenHash, hashSessionToken(token)),
          eq(customerAuthTokens.purpose, purpose),
          gt(customerAuthTokens.expiresAt, new Date()),
          isNull(customerAuthTokens.consumedAt),
          isNull(customerAuthTokens.revokedAt),
          eq(customerCredentials.status, expectedStatus),
          eq(customerCredentials.phoneNormalized, customers.phone),
          eq(customers.status, "active"),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  async consumePasswordToken(
    token: string,
    password: string,
    purpose: CustomerAuthPurpose,
  ) {
    return this.db.transaction(async (tx) => {
      const [match] = await tx
        .select({
          authToken: customerAuthTokens,
          credential: customerCredentials,
          customer: customers,
        })
        .from(customerAuthTokens)
        .innerJoin(
          customerCredentials,
          eq(customerAuthTokens.credentialId, customerCredentials.id),
        )
        .innerJoin(customers, eq(customerCredentials.customerId, customers.id))
        .where(
          and(
            eq(customerAuthTokens.tokenHash, hashSessionToken(token)),
            eq(customerAuthTokens.purpose, purpose),
          ),
        )
        .limit(1)
        .for("update");
      const now = new Date();
      if (
        !match ||
        match.authToken.consumedAt ||
        match.authToken.revokedAt ||
        match.authToken.expiresAt <= now ||
        match.customer.status !== "active" ||
        match.customer.deletedAt ||
        match.credential.phoneNormalized !== match.customer.phone ||
        (purpose === "activation" && match.credential.status !== "pending") ||
        (purpose === "recovery" && match.credential.status !== "active")
      )
        return null;

      const [consumed] = await tx
        .update(customerAuthTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(customerAuthTokens.id, match.authToken.id),
            isNull(customerAuthTokens.consumedAt),
            isNull(customerAuthTokens.revokedAt),
          ),
        )
        .returning({ id: customerAuthTokens.id });
      if (!consumed) throw new TokenConsumptionConflictError();

      const passwordHash = await this.passwordCrypto.hash(password);

      await tx
        .update(customerCredentials)
        .set({
          passwordHash,
          status: "active",
          activatedAt:
            purpose === "activation"
              ? (match.credential.activatedAt ?? now)
              : match.credential.activatedAt,
          passwordChangedAt: now,
          failedLoginCount: 0,
          lockedUntil: null,
          updatedAt: now,
        })
        .where(eq(customerCredentials.id, match.credential.id));
      await tx
        .update(customerAuthTokens)
        .set({ revokedAt: now })
        .where(
          and(
            eq(customerAuthTokens.credentialId, match.credential.id),
            isNull(customerAuthTokens.consumedAt),
            isNull(customerAuthTokens.revokedAt),
          ),
        );
      if (purpose === "recovery")
        await tx
          .update(customerSessions)
          .set({ revokedAt: now, revokeReason: "password_recovery" })
          .where(
            and(
              eq(customerSessions.credentialId, match.credential.id),
              isNull(customerSessions.revokedAt),
            ),
          );
      return { customerId: match.customer.id };
    });
  }

  private async recordFailedLogin(observed: {
    credentialId: string;
    passwordHash: string;
    phone: string;
  }) {
    await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ credential: customerCredentials, customer: customers })
        .from(customerCredentials)
        .innerJoin(
          customers,
          eq(customerCredentials.customerId, customers.id),
        )
        .where(eq(customerCredentials.id, observed.credentialId))
        .limit(1)
        .for("update");
      const now = new Date();
      if (
        !current ||
        current.credential.passwordHash !== observed.passwordHash ||
        current.credential.status !== "active" ||
        current.credential.phoneNormalized !== observed.phone ||
        current.credential.phoneNormalized !== current.customer.phone ||
        current.customer.status !== "active" ||
        current.customer.deletedAt ||
        (current.credential.lockedUntil &&
          current.credential.lockedUntil > now)
      )
        return;
      const previousLockExpired =
        current.credential.lockedUntil !== null &&
        current.credential.lockedUntil <= now;
      const baseCount = previousLockExpired
        ? 0
        : current.credential.failedLoginCount;
      const failedLoginCount = baseCount + 1;
      await tx
        .update(customerCredentials)
        .set({
          failedLoginCount,
          lockedUntil:
            failedLoginCount === ACCOUNT_LOCK_ATTEMPTS
              ? new Date(now.getTime() + ACCOUNT_LOCK_MS)
              : null,
          updatedAt: now,
        })
        .where(eq(customerCredentials.id, current.credential.id));
    });
  }

  async authenticateAndCreateSession(
    phone: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const [match] = await this.db
      .select({ credential: customerCredentials, customer: customers })
      .from(customerCredentials)
      .innerJoin(customers, eq(customerCredentials.customerId, customers.id))
      .where(eq(customerCredentials.phoneNormalized, phone))
      .limit(1);
    const initialNow = new Date();
    const eligible =
      !!match &&
      match.credential.status === "active" &&
      !!match.credential.passwordHash &&
      (!match.credential.lockedUntil ||
        match.credential.lockedUntil <= initialNow) &&
      match.credential.phoneNormalized === match.customer.phone &&
      match.customer.status === "active" &&
      !match.customer.deletedAt;
    const passwordHash = eligible
      ? match.credential.passwordHash!
      : await this.passwordCrypto.dummyHash;
    const passwordMatches = await this.passwordCrypto.verify(
      passwordHash,
      password,
    );
    const valid = eligible && passwordMatches;
    if (!valid) {
      if (eligible)
        await this.recordFailedLogin({
          credentialId: match.credential.id,
          passwordHash: match.credential.passwordHash!,
          phone,
        });
      return null;
    }

    const verifiedPasswordHash = match.credential.passwordHash!;
    const token = generateSessionToken();
    const csrfToken = generateCsrfToken();
    const authenticated = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ credential: customerCredentials, customer: customers })
        .from(customerCredentials)
        .innerJoin(
          customers,
          eq(customerCredentials.customerId, customers.id),
        )
        .where(eq(customerCredentials.id, match.credential.id))
        .limit(1)
        .for("update");
      const now = new Date();
      if (
        !current ||
        current.credential.passwordHash !== verifiedPasswordHash ||
        current.credential.status !== "active" ||
        current.credential.phoneNormalized !== phone ||
        current.credential.phoneNormalized !== current.customer.phone ||
        current.customer.status !== "active" ||
        current.customer.deletedAt ||
        (current.credential.lockedUntil &&
          current.credential.lockedUntil > now)
      )
        return null;

      await tx
        .update(customerCredentials)
        .set({ failedLoginCount: 0, lockedUntil: null, updatedAt: now })
        .where(eq(customerCredentials.id, current.credential.id));
      const absoluteExpiresAt = new Date(
        now.getTime() + SESSION_ABSOLUTE_MS,
      );
      await tx.insert(customerSessions).values({
        credentialId: current.credential.id,
        tokenHash: hashSessionToken(token),
        csrfTokenHash: hashSessionToken(csrfToken),
        ipAddress,
        userAgent,
        expiresAt: new Date(now.getTime() + SESSION_IDLE_MS),
        absoluteExpiresAt,
      });
      return current;
    });
    return authenticated ? { token, csrfToken } : null;
  }

  async session(token: string) {
    const [match] = await this.db
      .select({
        session: customerSessions,
        credential: customerCredentials,
        customer: customers,
      })
      .from(customerSessions)
      .innerJoin(
        customerCredentials,
        eq(customerSessions.credentialId, customerCredentials.id),
      )
      .innerJoin(customers, eq(customerCredentials.customerId, customers.id))
      .where(eq(customerSessions.tokenHash, hashSessionToken(token)))
      .limit(1);
    const now = new Date();
    if (
      !match ||
      match.session.revokedAt ||
      match.session.expiresAt <= now ||
      match.session.absoluteExpiresAt <= now ||
      match.credential.status !== "active" ||
      match.credential.phoneNormalized !== match.customer.phone ||
      match.customer.status !== "active" ||
      match.customer.deletedAt
    )
      return null;
    const renewal = calculateSessionRenewal(
      now,
      match.session.lastSeenAt,
      match.session.absoluteExpiresAt,
    );
    if (renewal)
      await this.db
        .update(customerSessions)
        .set({ lastSeenAt: now, expiresAt: renewal })
        .where(eq(customerSessions.id, match.session.id));
    return match;
  }

  async logout(sessionId: string) {
    await this.db
      .update(customerSessions)
      .set({ revokedAt: new Date(), revokeReason: "logout" })
      .where(eq(customerSessions.id, sessionId));
  }

  async rotateCsrf(sessionId: string) {
    const csrfToken = generateCsrfToken();
    const [updated] = await this.db
      .update(customerSessions)
      .set({ csrfTokenHash: hashSessionToken(csrfToken) })
      .where(
        and(
          eq(customerSessions.id, sessionId),
          isNull(customerSessions.revokedAt),
        ),
      )
      .returning({ id: customerSessions.id });
    return updated ? csrfToken : null;
  }
}
