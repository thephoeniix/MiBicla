import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { administrators } from "../schema.js";
export type PurchaseRule = { minimumAmount: number; units: number };
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 254 }),
    birthDate: date("birth_date"),
    notes: text("notes"),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("customers_name_idx").on(t.lastName, t.firstName),
    index("customers_phone_idx").on(t.phone),
    index("customers_status_idx").on(t.status),
  ],
);
export const customerPublicTokens = pgTable(
  "customer_public_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    publicTokenHash: varchar("public_token_hash", { length: 64 })
      .notNull()
      .unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    active: boolean("active").default(true).notNull(),
  },
  (t) => [
    index("customer_tokens_customer_idx").on(t.customerId),
    index("customer_tokens_active_idx").on(t.active),
  ],
);
export const loyaltySettings = pgTable(
  "loyalty_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enabled: boolean("enabled").default(false).notNull(),
    currency: varchar("currency", { length: 3 }).default("MXN").notNull(),
    purchaseRules: jsonb("purchase_rules")
      .$type<PurchaseRule[]>()
      .default([])
      .notNull(),
    rewardUnits: integer("reward_units").notNull(),
    rewardDiscountPercent: numeric("reward_discount_percent", {
      precision: 5,
      scale: 2,
    }).notNull(),
    rewardName: varchar("reward_name", { length: 150 }).notNull(),
    rewardDescription: text("reward_description").notNull(),
    allowManualAdjustments: boolean("allow_manual_adjustments")
      .default(false)
      .notNull(),
    allowNegativeBalance: boolean("allow_negative_balance")
      .default(false)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid("updated_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("loyalty_settings_singleton_idx").on(sql`(true)`),
    check("loyalty_reward_units_positive", sql`${t.rewardUnits}>0`),
    check(
      "loyalty_discount_range",
      sql`${t.rewardDiscountPercent}>=0 AND ${t.rewardDiscountPercent}<=100`,
    ),
  ],
);
export const customerLoyaltyBalance = pgTable(
  "customer_loyalty_balance",
  {
    customerId: uuid("customer_id")
      .primaryKey()
      .references(() => customers.id, { onDelete: "cascade" }),
    availableUnits: integer("available_units").default(0).notNull(),
    pendingUnits: integer("pending_units").default(0).notNull(),
    lifetimeUnits: integer("lifetime_units").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check("loyalty_pending_nonnegative", sql`${t.pendingUnits}>=0`),
    check("loyalty_lifetime_nonnegative", sql`${t.lifetimeUnits}>=0`),
  ],
);
export const customerRewards = pgTable(
  "customer_rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    rewardName: varchar("reward_name", { length: 150 }).notNull(),
    rewardDiscountPercent: numeric("reward_discount_percent", {
      precision: 5,
      scale: 2,
    }).notNull(),
    requiredUnits: integer("required_units").notNull(),
    status: varchar("status", { length: 20 }).default("available").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    index("customer_rewards_customer_idx").on(t.customerId),
    index("customer_rewards_status_idx").on(t.status),
  ],
);
export const customerLoyaltyMovements = pgTable(
  "customer_loyalty_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    units: integer("units").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    movementType: varchar("movement_type", { length: 30 }).default("manual_adjustment").notNull(),
    createdBy: uuid("created_by").references(() => administrators.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("loyalty_movements_customer_idx").on(t.customerId, t.createdAt)],
);
