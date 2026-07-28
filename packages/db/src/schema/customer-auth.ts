import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { administrators } from "../schema.js";
import { customers } from "./phase-2.js";

export const customerCredentials = pgTable(
  "customer_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .unique()
      .references(() => customers.id, { onDelete: "cascade" }),
    phoneNormalized: varchar("phone_normalized", { length: 20 })
      .notNull()
      .unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    failedLoginCount: integer("failed_login_count").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "customer_credentials_status",
      sql`${t.status} IN ('pending','active','disabled')`,
    ),
    check(
      "customer_credentials_failed_nonnegative",
      sql`${t.failedLoginCount} >= 0`,
    ),
    index("customer_credentials_status_idx").on(t.status),
  ],
);

export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    credentialId: uuid("credential_id")
      .notNull()
      .references(() => customerCredentials.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    csrfTokenHash: varchar("csrf_token_hash", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", {
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: varchar("revoke_reason", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "customer_sessions_expiry_order",
      sql`${t.expiresAt} <= ${t.absoluteExpiresAt}`,
    ),
    check(
      "customer_sessions_revoked_order",
      sql`${t.revokedAt} IS NULL OR ${t.revokedAt} >= ${t.createdAt}`,
    ),
    index("customer_sessions_credential_idx").on(t.credentialId),
    index("customer_sessions_active_idx").on(t.absoluteExpiresAt),
  ],
);

export const customerAuthTokens = pgTable(
  "customer_auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    credentialId: uuid("credential_id")
      .notNull()
      .references(() => customerCredentials.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", { length: 20 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "customer_auth_tokens_purpose",
      sql`${t.purpose} IN ('activation','recovery')`,
    ),
    check(
      "customer_auth_tokens_expiry",
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
    index("customer_auth_tokens_credential_idx").on(
      t.credentialId,
      t.purpose,
    ),
    index("customer_auth_tokens_active_idx").on(t.tokenHash, t.expiresAt),
  ],
);
