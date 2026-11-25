import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { customerAuthTokens } from "./customer-auth.js";
import { customers } from "./phase-2.js";
import { workshopOrders, workshopRequests } from "./workshop.js";

export const publicLinks = pgTable(
  "public_links",
  {
    id: uuid("id").primaryKey(),
    purpose: varchar("purpose", { length: 40 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    workshopOrderId: uuid("workshop_order_id").references(() => workshopOrders.id, { onDelete: "cascade" }),
    workshopRequestId: uuid("workshop_request_id").references(() => workshopRequests.id, { onDelete: "cascade" }),
    customerAuthTokenId: uuid("customer_auth_token_id").references(() => customerAuthTokens.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    metadata: jsonb("metadata").$type<Record<string, string>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    check("public_links_purpose", sql`${t.purpose} IN ('workshop_tracking','customer_activation','customer_verification','password_recovery','customer_card','workshop_request')`),
    check("public_links_status", sql`${t.status} IN ('active','consumed','revoked')`),
    check("public_links_expiry", sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.createdAt}`),
    check("public_links_single_resource", sql`num_nonnulls(${t.customerId}, ${t.workshopOrderId}, ${t.workshopRequestId}, ${t.customerAuthTokenId}) = 1`),
    index("public_links_order_idx").on(t.workshopOrderId),
    index("public_links_request_idx").on(t.workshopRequestId),
    index("public_links_customer_idx").on(t.customerId),
    index("public_links_auth_token_idx").on(t.customerAuthTokenId),
    uniqueIndex("public_links_active_order_unique").on(t.purpose, t.workshopOrderId).where(sql`${t.status} = 'active' AND ${t.workshopOrderId} IS NOT NULL`),
    uniqueIndex("public_links_active_request_unique").on(t.purpose, t.workshopRequestId).where(sql`${t.status} = 'active' AND ${t.workshopRequestId} IS NOT NULL`),
    uniqueIndex("public_links_active_customer_unique").on(t.purpose, t.customerId).where(sql`${t.status} = 'active' AND ${t.customerId} IS NOT NULL`),
  ],
);
