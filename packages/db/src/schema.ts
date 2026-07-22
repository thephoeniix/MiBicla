import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};
export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 500 }),
  ...timestamps,
});
export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: varchar("description", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
export const administrators = pgTable(
  "administrators",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 150 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    emailNormalized: varchar("email_normalized", { length: 254 })
      .notNull()
      .unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    failedLoginCount: integer("failed_login_count").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "administrators_failed_login_nonnegative",
      sql`${t.failedLoginCount} >= 0`,
    ),
    index("administrators_role_id_idx").on(t.roleId),
    index("administrators_active_idx")
      .on(t.isActive)
      .where(sql`${t.deletedAt} is null`),
  ],
);
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    administratorId: uuid("administrator_id")
      .notNull()
      .references(() => administrators.id, { onDelete: "cascade" }),
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
      "sessions_expiry_order",
      sql`${t.expiresAt} <= ${t.absoluteExpiresAt}`,
    ),
    check(
      "sessions_revoked_order",
      sql`${t.revokedAt} is null or ${t.revokedAt} >= ${t.createdAt}`,
    ),
    index("sessions_administrator_idx").on(t.administratorId),
    index("sessions_absolute_active_idx")
      .on(t.absoluteExpiresAt)
      .where(sql`${t.revokedAt} is null`),
  ],
);
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    administratorId: uuid("administrator_id").references(
      () => administrators.id,
      { onDelete: "set null" },
    ),
    requestId: uuid("request_id").notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    success: boolean("success").notNull(),
    failureReasonCode: varchar("failure_reason_code", { length: 100 }),
    entityType: varchar("entity_type", { length: 100 }),
    entityId: uuid("entity_id"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check("audit_metadata_object", sql`jsonb_typeof(${t.metadata}) = 'object'`),
    index("audit_request_id_idx").on(t.requestId),
    index("audit_administrator_idx").on(t.administratorId),
    index("audit_created_at_idx").on(t.createdAt),
  ],
);
export const rateLimits = pgTable(
  "rate_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scope: varchar("scope", { length: 50 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
    }).notNull(),
    attemptCount: integer("attempt_count").default(1).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("rate_limits_window_unique").on(
      t.scope,
      t.keyHash,
      t.windowStartedAt,
    ),
    check("rate_limits_attempt_positive", sql`${t.attemptCount} >= 1`),
    check(
      "rate_limits_expiry_order",
      sql`${t.expiresAt} > ${t.windowStartedAt}`,
    ),
    index("rate_limits_scope_key_idx").on(t.scope, t.keyHash),
    index("rate_limits_expires_idx").on(t.expiresAt),
  ],
);
