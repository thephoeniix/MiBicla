import { createHmac, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { publicLinks, rateLimits, type createDatabase } from "@mi-bicla/db";
import { hashRateLimitKey, sha256 } from "@mi-bicla/shared";

type Db = ReturnType<typeof createDatabase>["db"];
export type PublicLinkPurpose =
  | "workshop_tracking"
  | "customer_activation"
  | "customer_verification"
  | "password_recovery"
  | "customer_card"
  | "workshop_request";
type Resource = {
  customerId?: string;
  workshopOrderId?: string;
  workshopRequestId?: string;
  customerAuthTokenId?: string;
};

export type PublicLinkState = "active" | "expired" | "consumed" | "revoked" | "invalid";

export class PublicLinksService {
  readonly baseUrl: string;

  constructor(private db: Db, private secret: string, appBaseUrl: string) {
    const url = new URL(appBaseUrl);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    this.baseUrl = url.toString().replace(/\/$/, "");
  }

  private code(id: string) {
    return createHmac("sha256", this.secret).update(`public-link:${id}`).digest("base64url").slice(0, 16);
  }

  buildUrl(code: string) {
    return new URL(`/l/${encodeURIComponent(code)}`, this.baseUrl).toString();
  }

  async getOrCreateActiveLink(purpose: PublicLinkPurpose, resource: Resource, expiresAt?: Date | null) {
    const now = new Date();
    const filters = [eq(publicLinks.purpose, purpose), eq(publicLinks.status, "active")];
    if (resource.customerId) filters.push(eq(publicLinks.customerId, resource.customerId));
    if (resource.workshopOrderId) filters.push(eq(publicLinks.workshopOrderId, resource.workshopOrderId));
    if (resource.workshopRequestId) filters.push(eq(publicLinks.workshopRequestId, resource.workshopRequestId));
    if (resource.customerAuthTokenId) filters.push(eq(publicLinks.customerAuthTokenId, resource.customerAuthTokenId));
    const [existing] = await this.db.select().from(publicLinks).where(and(...filters)).limit(1);
    if (existing && !existing.revokedAt && !existing.consumedAt && (!existing.expiresAt || existing.expiresAt > now)) {
      const code = this.code(existing.id);
      return { code, url: this.buildUrl(code), id: existing.id, expiresAt: existing.expiresAt };
    }
    if (existing) await this.db.update(publicLinks).set({ status: "revoked", revokedAt: now }).where(eq(publicLinks.id, existing.id));
    const id = randomUUID();
    const code = this.code(id);
    await this.db.insert(publicLinks).values({ id, purpose, codeHash: sha256(code), expiresAt, ...resource });
    return { code, url: this.buildUrl(code), id, expiresAt: expiresAt ?? null };
  }

  async regenerateLink(purpose: PublicLinkPurpose, resource: Resource, expiresAt?: Date | null) {
    await this.revokeLink(purpose, resource);
    return this.getOrCreateActiveLink(purpose, resource, expiresAt);
  }

  async revokeLink(purpose: PublicLinkPurpose, resource: Resource) {
    const now = new Date();
    const filters = [eq(publicLinks.purpose, purpose), eq(publicLinks.status, "active")];
    if (resource.customerId) filters.push(eq(publicLinks.customerId, resource.customerId));
    if (resource.workshopOrderId) filters.push(eq(publicLinks.workshopOrderId, resource.workshopOrderId));
    if (resource.workshopRequestId) filters.push(eq(publicLinks.workshopRequestId, resource.workshopRequestId));
    if (resource.customerAuthTokenId) filters.push(eq(publicLinks.customerAuthTokenId, resource.customerAuthTokenId));
    await this.db.update(publicLinks).set({ status: "revoked", revokedAt: now }).where(and(...filters));
  }

  async resolveLink(code: string) {
    if (!/^[A-Za-z0-9_-]{16}$/.test(code)) return { state: "invalid" as const };
    const [link] = await this.db.select().from(publicLinks).where(eq(publicLinks.codeHash, sha256(code))).limit(1);
    if (!link) return { state: "invalid" as const };
    const state: PublicLinkState = link.revokedAt || link.status === "revoked"
      ? "revoked"
      : link.consumedAt || link.status === "consumed"
        ? "consumed"
        : link.expiresAt && link.expiresAt <= new Date()
          ? "expired"
          : "active";
    if (state === "active") await this.db.update(publicLinks).set({ lastUsedAt: new Date() }).where(eq(publicLinks.id, link.id));
    return { state, link };
  }

  async consume(id: string) {
    const now = new Date();
    const [row] = await this.db.update(publicLinks).set({ status: "consumed", consumedAt: now })
      .where(and(eq(publicLinks.id, id), eq(publicLinks.status, "active"), isNull(publicLinks.consumedAt), isNull(publicLinks.revokedAt), gt(publicLinks.expiresAt, now)))
      .returning({ id: publicLinks.id });
    return !!row;
  }

  async invalidResolutionLimited(ip: string) {
    const windowMs = 15 * 60 * 1000;
    const start = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const [row] = await this.db.insert(rateLimits).values({
      scope: "public-link-invalid",
      keyHash: hashRateLimitKey(`public-link:${ip}`),
      windowStartedAt: start,
      expiresAt: new Date(start.getTime() + windowMs),
    }).onConflictDoUpdate({
      target: [rateLimits.scope, rateLimits.keyHash, rateLimits.windowStartedAt],
      set: { attemptCount: sql`${rateLimits.attemptCount} + 1`, updatedAt: new Date() },
    }).returning({ count: rateLimits.attemptCount });
    return (row?.count ?? 1) > 10;
  }
}

export function buildWhatsappMessage(template: string, variables: Record<string, string>) {
  return template.replace(/\{([a-z_]+)\}/g, (_match, key: string) => variables[key] ?? "").trim();
}

export function buildWhatsappUrl(phone: string, message: string) {
  const url = new URL(`https://wa.me/${phone.replace(/\D/g, "")}`);
  url.searchParams.set("text", message);
  return url.toString();
}
