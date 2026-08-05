import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  customerCredentials,
  customerLoyaltyBalance,
  customerPublicTokens,
  customerRegistrationRequests,
  customers,
  type createDatabase,
} from "@mi-bicla/db";
import { generateSessionToken, sha256 } from "@mi-bicla/shared";
import type { CustomerRegistrationInput } from "@mi-bicla/api-contract";
import { issueCustomerAuthToken } from "./customer-auth-tokens.js";

type Db = ReturnType<typeof createDatabase>["db"];
const REGISTRATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class CustomerRegistrationService {
  constructor(private db: Db, private appBaseUrl: string) {}

  async create(input: CustomerRegistrationInput) {
    const reviewId = generateSessionToken();
    const reference = `MB-${generateSessionToken().slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + REGISTRATION_TTL_MS);
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.phone}, 0))`);
      const [pending] = await tx.select().from(customerRegistrationRequests)
        .where(and(
          eq(customerRegistrationRequests.phoneNormalized, input.phone),
          eq(customerRegistrationRequests.status, "pending"),
        )).limit(1);
      if (pending) {
        await tx.update(customerRegistrationRequests).set({
          status: "expired",
          passwordHash: null,
          decidedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(customerRegistrationRequests.id, pending.id));
      }
      const [request] = await tx.insert(customerRegistrationRequests).values({
        reviewId,
        publicReference: reference,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNormalized: input.phone,
        expiresAt,
      }).returning({
        reference: customerRegistrationRequests.publicReference,
        reviewId: customerRegistrationRequests.reviewId,
        expiresAt: customerRegistrationRequests.expiresAt,
      });
      if (!request) throw new Error("No se pudo crear la solicitud");
      return {
        reference: request.reference,
        expiresAt: request.expiresAt,
        adminReviewUrl: `${this.appBaseUrl.replace(/\/$/, "")}/admin/customers/requests/${request.reviewId}`,
        message: "Recibimos tu solicitud. Mi Bicla verificará tu número y te enviará por WhatsApp un enlace para crear tu contraseña.",
      };
    });
  }

  async list() {
    const now = new Date();
    await this.db.update(customerRegistrationRequests).set({
      status: "expired", passwordHash: null, decidedAt: now, updatedAt: now,
    }).where(and(
      eq(customerRegistrationRequests.status, "pending"),
      sql`${customerRegistrationRequests.expiresAt} <= ${now}`,
    ));
    return this.db.select({
      reviewId: customerRegistrationRequests.reviewId,
      reference: customerRegistrationRequests.publicReference,
      firstName: customerRegistrationRequests.firstName,
      lastName: customerRegistrationRequests.lastName,
      status: customerRegistrationRequests.status,
      createdAt: customerRegistrationRequests.createdAt,
      expiresAt: customerRegistrationRequests.expiresAt,
    }).from(customerRegistrationRequests).orderBy(desc(customerRegistrationRequests.createdAt)).limit(100);
  }

  async get(reviewId: string) {
    const [request] = await this.db.select({
      reviewId: customerRegistrationRequests.reviewId,
      reference: customerRegistrationRequests.publicReference,
      firstName: customerRegistrationRequests.firstName,
      lastName: customerRegistrationRequests.lastName,
      phone: customerRegistrationRequests.phoneNormalized,
      email: customerRegistrationRequests.email,
      status: customerRegistrationRequests.status,
      createdAt: customerRegistrationRequests.createdAt,
      expiresAt: customerRegistrationRequests.expiresAt,
      decidedAt: customerRegistrationRequests.decidedAt,
    }).from(customerRegistrationRequests)
      .where(eq(customerRegistrationRequests.reviewId, reviewId)).limit(1);
    return request ?? null;
  }

  // Operación única "Verificar y generar activación": aprueba la solicitud,
  // crea/vincula al cliente, crea una credencial pendiente (sin contraseña)
  // y su token de activación — todo en una sola transacción. Si cualquier
  // paso falla, Postgres revierte todo: nunca queda un cliente aprobado sin
  // activación ni una activación sin cliente aprobado. Reutiliza
  // issueCustomerAuthToken (mismo helper que generateLink) para no duplicar
  // la lógica de revocar+emitir token.
  async verifyAndActivate(reviewId: string, administratorId: string) {
    const result = await this.db.transaction(async (tx) => {
      const [request] = await tx.select().from(customerRegistrationRequests)
        .where(eq(customerRegistrationRequests.reviewId, reviewId)).for("update").limit(1);
      const now = new Date();
      if (!request || request.status !== "pending") return null;
      if (request.expiresAt <= now) {
        await tx.update(customerRegistrationRequests).set({
          status: "expired", passwordHash: null, decidedAt: now, updatedAt: now,
        }).where(eq(customerRegistrationRequests.id, request.id));
        return null;
      }
      const matches = await tx.select().from(customers).where(and(
        eq(customers.phone, request.phoneNormalized),
        isNull(customers.deletedAt),
      )).limit(2);
      if (matches.length > 1) return null;
      let customer = matches[0];
      if (customer) {
        const [existingCredential] = await tx.select().from(customerCredentials)
          .where(eq(customerCredentials.customerId, customer.id)).limit(1).for("update");
        if (customer.status !== "active" || existingCredential) return null;
      } else {
        [customer] = await tx.insert(customers).values({
          firstName: request.firstName,
          lastName: request.lastName,
          phone: request.phoneNormalized,
          email: request.email,
          status: "active",
          createdBy: administratorId,
          updatedBy: administratorId,
        }).returning();
        if (!customer) throw new Error("No se pudo crear el cliente");
        const publicToken = generateSessionToken();
        await tx.insert(customerLoyaltyBalance).values({ customerId: customer.id });
        await tx.insert(customerPublicTokens).values({
          customerId: customer.id,
          publicTokenHash: sha256(publicToken),
        });
      }
      // Credencial pendiente, deliberadamente sin passwordHash: la
      // contraseña anterior de la solicitud (si existía, de un registro
      // previo al cambio de flujo) nunca se copia aquí.
      const [credential] = await tx.insert(customerCredentials).values({
        customerId: customer.id,
        phoneNormalized: request.phoneNormalized,
      }).returning();
      if (!credential) throw new Error("No se pudo crear la credencial");
      const { token, expiresAt } = await issueCustomerAuthToken(tx, {
        credentialId: credential.id,
        purpose: "activation",
        administratorId,
      });
      await tx.update(customerRegistrationRequests).set({
        status: "approved",
        passwordHash: null,
        decidedBy: administratorId,
        decidedAt: now,
        updatedAt: now,
      }).where(eq(customerRegistrationRequests.id, request.id));
      return {
        customerId: customer.id,
        firstName: request.firstName,
        phoneNormalized: request.phoneNormalized,
        token,
        expiresAt,
      };
    });
    if (!result) return null;
    const link = new URL("/cuenta/activar", this.appBaseUrl);
    link.searchParams.set("token", result.token);
    const expiry = result.expiresAt.toLocaleString("es-MX", {
      dateStyle: "long",
      timeStyle: "short",
    });
    const message = [
      `Hola, ${result.firstName}. Mi Bicla verificó tu solicitud.`,
      "",
      "Crea tu contraseña para activar tu cuenta:",
      link.toString(),
      "",
      `Este enlace es personal, vence el ${expiry} y solo puede utilizarse una vez.`,
    ].join("\n");
    const whatsappUrl = new URL(
      `https://wa.me/${result.phoneNormalized.replace(/\D/g, "")}`,
    );
    whatsappUrl.searchParams.set("text", message);
    return {
      customerId: result.customerId,
      expiresAt: result.expiresAt,
      link: link.toString(),
      whatsappUrl: whatsappUrl.toString(),
    };
  }

  async reject(reviewId: string, administratorId: string, reason?: string) {
    return this.db.transaction(async (tx) => {
      const [request] = await tx.select().from(customerRegistrationRequests)
        .where(eq(customerRegistrationRequests.reviewId, reviewId)).for("update").limit(1);
      if (!request || request.status !== "pending") return false;
      const now = new Date();
      await tx.update(customerRegistrationRequests).set({
        status: "rejected",
        passwordHash: null,
        decidedBy: administratorId,
        decidedAt: now,
        rejectionReason: reason || null,
        updatedAt: now,
      }).where(eq(customerRegistrationRequests.id, request.id));
      return true;
    });
  }
}
