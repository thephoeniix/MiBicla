import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { administrators } from "../schema.js";
import { customers } from "./phase-2.js";
const c = () =>
    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  u = () =>
    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
export const customerBicycles = pgTable(
  "customer_bicycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    nickname: text("nickname"),
    brand: text("brand"),
    model: text("model"),
    year: integer("year"),
    bikeType: text("bike_type"),
    color: text("color"),
    wheelSize: text("wheel_size"),
    brakeType: text("brake_type"),
    suspensionType: text("suspension_type"),
    drivetrain: text("drivetrain"),
    generalCondition: text("general_condition"),
    serialNumber: text("serial_number"),
    frameNumber: text("frame_number"),
    notes: text("notes"),
    photoUrl: text("photo_url"),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdAt: c(),
    updatedAt: u(),
    createdBy: uuid("created_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("bicycles_customer_idx").on(t.customerId)],
);
export const workshopRequests = pgTable(
  "workshop_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestNumber: varchar("request_number", { length: 40 }).notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    bicycleId: uuid("bicycle_id").references(() => customerBicycles.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    customerEmail: varchar("customer_email", { length: 254 }),
    bikeBrand: text("bike_brand"),
    bikeModel: text("bike_model"),
    bikeType: text("bike_type"),
    problemDescription: text("problem_description").notNull(),
    preferredContactMethod: varchar("preferred_contact_method", {
      length: 20,
    }).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    createdAt: c(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    convertedOrderId: uuid("converted_order_id"),
    rejectionReason: text("rejection_reason"),
  },
  (t) => [index("workshop_requests_status_idx").on(t.status)],
);
export const workshopOrders = pgTable(
  "workshop_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: varchar("order_number", { length: 40 }).notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    bicycleId: uuid("bicycle_id")
      .notNull()
      .references(() => customerBicycles.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").references(() => workshopRequests.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 30 }).default("received").notNull(),
    priority: varchar("priority", { length: 20 }).default("normal").notNull(),
    problemDescription: text("problem_description").notNull(),
    initialDiagnosis: text("initial_diagnosis"),
    internalNotes: text("internal_notes"),
    customerVisibleSummary: text("customer_visible_summary"),
    estimatedCompletionAt: timestamp("estimated_completion_at", {
      withTimezone: true,
    }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    subtotalServicesCents: integer("subtotal_services_cents")
      .default(0)
      .notNull(),
    subtotalPartsCents: integer("subtotal_parts_cents").default(0).notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    amountPaidCents: integer("amount_paid_cents").default(0).notNull(),
    paymentStatus: varchar("payment_status", { length: 20 })
      .default("pending")
      .notNull(),
    createdAt: c(),
    updatedAt: u(),
    createdBy: uuid("created_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    assignedTo: uuid("assigned_to").references(() => administrators.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("workshop_orders_status_idx").on(t.status),
    index("workshop_orders_customer_idx").on(t.customerId),
  ],
);
export const workshopServiceCatalog = pgTable(
  "workshop_service_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    suggestedPriceCents: integer("suggested_price_cents").default(0).notNull(),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    isCustomerVisible: boolean("is_customer_visible").default(true).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: c(),
    updatedAt: u(),
    createdBy: uuid("created_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("workshop_service_catalog_active_idx").on(t.isActive, t.sortOrder),
    check(
      "workshop_service_catalog_values",
      sql`${t.suggestedPriceCents}>=0 AND (${t.estimatedDurationMinutes} IS NULL OR ${t.estimatedDurationMinutes}>0)`,
    ),
  ],
);
const child = {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopOrderId: uuid("workshop_order_id")
    .notNull()
    .references(() => workshopOrders.id, { onDelete: "cascade" }),
  createdAt: c(),
  updatedAt: u(),
};
export const workshopOrderServices = pgTable(
  "workshop_order_services",
  {
    ...child,
    catalogServiceId: uuid("catalog_service_id").references(
      () => workshopServiceCatalog.id,
      { onDelete: "restrict" },
    ),
    serviceName: text("service_name").notNull(),
    description: text("description"),
    quantity: integer("quantity").default(1).notNull(),
    unitPriceCents: integer("unit_price_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    isCustomerVisible: boolean("is_customer_visible").default(true).notNull(),
    performedBy: uuid("performed_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("workshop_services_order_idx").on(t.workshopOrderId),
    check(
      "workshop_service_values",
      sql`${t.quantity}>0 AND ${t.unitPriceCents}>=0`,
    ),
  ],
);
export const workshopOrderParts = pgTable(
  "workshop_order_parts",
  {
    ...child,
    productId: uuid("product_id"),
    partName: text("part_name").notNull(),
    brand: text("brand"),
    sku: text("sku"),
    description: text("description"),
    quantity: integer("quantity").default(1).notNull(),
    unitPriceCents: integer("unit_price_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    status: varchar("status", { length: 20 }).default("planned").notNull(),
    isCustomerVisible: boolean("is_customer_visible").default(true).notNull(),
    installedAt: timestamp("installed_at", { withTimezone: true }),
    installedBy: uuid("installed_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("workshop_parts_order_idx").on(t.workshopOrderId),
    check(
      "workshop_part_values",
      sql`${t.quantity}>0 AND ${t.unitPriceCents}>=0`,
    ),
  ],
);
export const workshopStatusHistory = pgTable(
  "workshop_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopOrderId: uuid("workshop_order_id")
      .notNull()
      .references(() => workshopOrders.id, { onDelete: "cascade" }),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    publicMessage: text("public_message"),
    internalReason: text("internal_reason"),
    changedBy: uuid("changed_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    createdAt: c(),
    customerVisible: boolean("customer_visible").default(true).notNull(),
  },
  (t) => [
    index("workshop_history_order_idx").on(t.workshopOrderId, t.createdAt),
  ],
);
export const workshopCustomerUpdates = pgTable(
  "workshop_customer_updates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopOrderId: uuid("workshop_order_id")
      .notNull()
      .references(() => workshopOrders.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    progressPercent: integer("progress_percent"),
    photoUrl: text("photo_url"),
    customerVisible: boolean("customer_visible").default(true).notNull(),
    createdBy: uuid("created_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
    createdAt: c(),
    updatedAt: u(),
  },
  (t) => [
    index("workshop_updates_order_idx").on(t.workshopOrderId, t.createdAt),
    check(
      "workshop_progress_range",
      sql`${t.progressPercent} IS NULL OR (${t.progressPercent}>=0 AND ${t.progressPercent}<=100)`,
    ),
  ],
);
export const workshopPublicTokens = pgTable(
  "workshop_public_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopOrderId: uuid("workshop_order_id")
      .notNull()
      .references(() => workshopOrders.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    active: boolean("active").default(true).notNull(),
    createdAt: c(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("workshop_tokens_order_idx").on(t.workshopOrderId)],
);
export const workshopNotifications = pgTable(
  "workshop_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopOrderId: uuid("workshop_order_id")
      .notNull()
      .references(() => workshopOrders.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 20 }).notNull(),
    recipient: text("recipient").notNull(),
    templateKey: text("template_key"),
    messagePreview: text("message_preview"),
    status: varchar("status", { length: 20 }).notNull(),
    externalReference: text("external_reference"),
    errorCode: text("error_code"),
    createdAt: c(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("workshop_notifications_order_idx").on(t.workshopOrderId)],
);
export const workshopSettings = pgTable(
  "workshop_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicRequestsEnabled: boolean("public_requests_enabled")
      .default(true)
      .notNull(),
    publicTrackingEnabled: boolean("public_tracking_enabled")
      .default(true)
      .notNull(),
    allowCustomerPhotos: boolean("allow_customer_photos")
      .default(false)
      .notNull(),
    defaultEstimatedDays: integer("default_estimated_days"),
    readyWhatsappTemplate: text("ready_whatsapp_template").notNull(),
    statusWhatsappTemplates: jsonb("status_whatsapp_templates")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    publicStatusLabels: jsonb("public_status_labels")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    createdAt: c(),
    updatedAt: u(),
    updatedBy: uuid("updated_by").references(() => administrators.id, {
      onDelete: "set null",
    }),
  },
  () => [uniqueIndex("workshop_settings_singleton_idx").on(sql`(true)`)],
);
