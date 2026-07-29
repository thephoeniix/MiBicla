import { sql } from "drizzle-orm";
import { check, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { administrators } from "../schema.js";

export const customerRegistrationRequests = pgTable(
  "customer_registration_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: varchar("review_id", { length: 64 }).notNull().unique(),
    publicReference: varchar("public_reference", { length: 16 }).notNull().unique(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phoneNormalized: varchar("phone_normalized", { length: 20 }).notNull(),
    email: varchar("email", { length: 254 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    decidedBy: uuid("decided_by").references(() => administrators.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    rejectionReason: varchar("rejection_reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("customer_registration_requests_status", sql`${t.status} IN ('pending','approved','rejected','expired')`),
    check("customer_registration_requests_expiry", sql`${t.expiresAt} > ${t.createdAt}`),
    index("customer_registration_requests_status_idx").on(t.status, t.createdAt),
    index("customer_registration_requests_phone_idx").on(t.phoneNormalized),
    uniqueIndex("customer_registration_requests_pending_phone_idx").on(t.phoneNormalized).where(sql`${t.status} = 'pending'`),
  ],
);
