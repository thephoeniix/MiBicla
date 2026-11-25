import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
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
    bikeColor: text("bike_color"),
    bikeWheelSize: text("bike_wheel_size"),
    bikeYear: integer("bike_year"),
    bikeBrakeType: text("bike_brake_type"),
    bikeSuspensionType: text("bike_suspension_type"),
    bikeDrivetrain: text("bike_drivetrain"),
    bikeGeneralCondition: text("bike_general_condition"),
    bikeSerialNumber: text("bike_serial_number"),
    bikeFrameNumber: text("bike_frame_number"),
    bikeNotes: text("bike_notes"),
    bikeAccessories: text("bike_accessories"),
    catalogServiceId: uuid("catalog_service_id"),
    serviceName: text("service_name"),
    problemDescription: text("problem_description").notNull(),
    symptoms: text("symptoms"),
    visibleDamage: text("visible_damage"),
    additionalComments: text("additional_comments"),
    requestedDate: date("requested_date"),
    requestedTime: varchar("requested_time", { length: 20 }),
    desiredDeliveryDate: date("desired_delivery_date"),
    urgency: varchar("urgency", { length: 20 }),
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
    updatedAt: u(),
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
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: c(),
    updatedAt: u(),
    createdBy: uuid("created_by").references(() => administrators.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => administrators.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("teams_name_unique").on(sql`lower(${t.name})`)],
);
export const agreements = pgTable(
  "agreements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
    discountType: varchar("discount_type", { length: 20 }).notNull(),
    value: integer("value").notNull(),
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until"),
    conditions: text("conditions"),
    active: boolean("active").default(true).notNull(),
    combinable: boolean("combinable").default(false).notNull(),
    createdAt: c(),
    updatedAt: u(),
    createdBy: uuid("created_by").references(() => administrators.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => administrators.id, { onDelete: "set null" }),
  },
  (t) => [
    index("agreements_team_idx").on(t.teamId),
    check("agreements_type", sql`${t.discountType} IN ('percentage','fixed')`),
    check("agreements_value", sql`${t.value}>0 AND (${t.discountType}<>'percentage' OR ${t.value}<=10000)`),
    check("agreements_validity", sql`${t.validUntil} IS NULL OR ${t.validUntil}>=${t.validFrom}`),
  ],
);
export const customerTeamAffiliations = pgTable(
  "customer_team_affiliations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }),
    proposedTeamName: varchar("proposed_team_name", { length: 200 }),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    verificationDate: timestamp("verification_date", { withTimezone: true }),
    evidenceNote: text("evidence_note"),
    verifiedBy: uuid("verified_by").references(() => administrators.id, { onDelete: "set null" }),
    createdAt: c(),
    updatedAt: u(),
  },
  (t) => [
    index("customer_team_affiliations_customer_idx").on(t.customerId),
    uniqueIndex("customer_team_affiliations_current_unique").on(t.customerId).where(sql`${t.status} IN ('pending','verified')`),
    check("customer_team_affiliations_status", sql`${t.status} IN ('pending','verified','rejected','expired')`),
    check("customer_team_affiliations_team", sql`num_nonnulls(${t.teamId}, ${t.proposedTeamName})=1`),
  ],
);
export const workshopOrderAgreementApplications = pgTable(
  "workshop_order_agreement_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopOrderId: uuid("workshop_order_id").notNull().references(() => workshopOrders.id, { onDelete: "restrict" }),
    agreementId: uuid("agreement_id").notNull().references(() => agreements.id, { onDelete: "restrict" }),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
    teamName: varchar("team_name", { length: 200 }).notNull(),
    discountType: varchar("discount_type", { length: 20 }).notNull(),
    agreementValue: integer("agreement_value").notNull(),
    discountCents: integer("discount_cents").notNull(),
    conditions: text("conditions"),
    combinable: boolean("combinable").notNull(),
    appliedBy: uuid("applied_by").references(() => administrators.id, { onDelete: "set null" }),
    createdAt: c(),
  },
  (t) => [
    uniqueIndex("workshop_order_agreement_unique").on(t.workshopOrderId),
    check("workshop_order_agreement_discount", sql`${t.discountCents}>0`),
  ],
);
export const workshopFinancialMovements = pgTable(
  "workshop_financial_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopOrderId: uuid("workshop_order_id").notNull().references(() => workshopOrders.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 30 }).notNull(),
    // Positive amounts credit value toward the order; negative amounts remove value.
    amountCents: integer("amount_cents").notNull(),
    paymentMethod: varchar("payment_method", { length: 30 }),
    reference: varchar("reference", { length: 300 }),
    note: text("note"),
    occurredDate: date("occurred_date").notNull(),
    responsibleAdminId: uuid("responsible_admin_id").references(() => administrators.id, { onDelete: "restrict" }),
    correctedMovementId: uuid("corrected_movement_id").references((): AnyPgColumn => workshopFinancialMovements.id, { onDelete: "restrict" }),
    agreementApplicationId: uuid("agreement_application_id").references(() => workshopOrderAgreementApplications.id, { onDelete: "restrict" }),
    createdAt: c(),
  },
  (t) => [
    index("workshop_financial_movements_order_idx").on(t.workshopOrderId, t.createdAt),
    index("workshop_financial_movements_customer_idx").on(t.customerId, t.createdAt),
    uniqueIndex("workshop_financial_movement_reversal_unique").on(t.correctedMovementId).where(sql`${t.correctedMovementId} IS NOT NULL`),
    check("workshop_financial_movement_type", sql`${t.type} IN ('advance','payment','discount','credit_applied','charge','refund','correction')`),
    check("workshop_financial_movement_amount", sql`${t.amountCents}<>0`),
    check("workshop_financial_payment_method", sql`${t.paymentMethod} IS NULL OR ${t.paymentMethod} IN ('cash','card','transfer','customer_credit','agreement','other')`),
    check("workshop_financial_other_note", sql`${t.paymentMethod}<>'other' OR length(trim(coalesce(${t.note}, '')))>0`),
    check("workshop_financial_correction_link", sql`(${t.type}='correction')=(${t.correctedMovementId} IS NOT NULL)`),
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
    scheduleTimezone: varchar("schedule_timezone", { length: 64 }).default("America/Mexico_City").notNull(),
    minimumNoticeMinutes: integer("minimum_notice_minutes").default(120).notNull(),
    bookingHorizonDays: integer("booking_horizon_days").default(30).notNull(),
    dailyCapacity: integer("daily_capacity"),
    schedule: jsonb("schedule").$type<Record<string, string[]>>().default({}).notNull(),
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
