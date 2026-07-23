import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { administrators } from "../schema.js";
export const businessSettings = pgTable(
  "business_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessName: text("business_name").notNull(),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    primaryWhatsapp: text("primary_whatsapp").notNull(),
    secondaryWhatsapp: text("secondary_whatsapp").notNull(),
    facebook: text("facebook").notNull(),
    instagram: text("instagram").notNull(),
    tiktok: text("tiktok").notNull(),
    website: text("website").notNull(),
    openingHours: jsonb("opening_hours")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    logoUrl: text("logo_url").notNull(),
    faviconUrl: text("favicon_url").notNull(),
    themeColor: text("theme_color").notNull().default("#ec3d92"),
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
  () => [uniqueIndex("business_settings_singleton_idx").on(sql`(true)`)],
);
export const paymentDepositSettings = pgTable(
  "payment_deposit_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessSettingsId: uuid("business_settings_id")
      .notNull()
      .references(() => businessSettings.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    bankName: text("bank_name").notNull(),
    accountHolder: text("account_holder").notNull(),
    accountNumberEncrypted: text("account_number_encrypted"),
    clabeEncrypted: text("clabe_encrypted"),
    cardNumberEncrypted: text("card_number_encrypted"),
    referenceText: text("reference_text").notNull(),
    instructions: text("instructions").notNull(),
    whatsappNumber: text("whatsapp_number").notNull(),
    whatsappTemplate: text("whatsapp_template").notNull(),
    showAccountNumber: boolean("show_account_number").default(false).notNull(),
    showClabe: boolean("show_clabe").default(true).notNull(),
    showCardNumber: boolean("show_card_number").default(false).notNull(),
    showBank: boolean("show_bank").default(true).notNull(),
    showHolder: boolean("show_holder").default(true).notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
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
    index("payment_deposit_options_business_idx").on(t.businessSettingsId),
    index("payment_deposit_options_active_idx").on(t.isActive),
    index("payment_deposit_options_sort_idx").on(t.sortOrder),
  ],
);
