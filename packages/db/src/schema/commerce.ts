import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { customers } from "./phase-2.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    imageUrl: text("image_url"),
    priceCents: integer("price_cents"),
    discountPercent: integer("discount_percent").default(0).notNull(),
    sizes: jsonb("sizes").$type<string[]>().default([]).notNull(),
    colors: jsonb("colors").$type<string[]>().default([]).notNull(),
    availability: varchar("availability", { length: 20 })
      .default("available")
      .notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    ...timestamps,
  },
  (t) => [
    index("products_public_idx").on(t.isPublished, t.category),
    check(
      "products_price_nonnegative",
      sql`${t.priceCents} IS NULL OR ${t.priceCents} >= 0`,
    ),
    check(
      "products_discount_percent_valid",
      sql`${t.discountPercent} BETWEEN 0 AND 100`,
    ),
    check(
      "products_availability_valid",
      sql`${t.availability} IN ('available','on_request','unavailable')`,
    ),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    location: varchar("location", { length: 300 }).notNull(),
    category: varchar("category", { length: 20 }).notNull(),
    mapUrl: text("map_url"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    imageUrl: text("image_url"),
    infoUrl: text("info_url"),
    isPublished: boolean("is_published").default(false).notNull(),
    ...timestamps,
  },
  (t) => [
    index("events_public_idx").on(t.isPublished, t.startsAt),
    check(
      "events_date_order",
      sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`,
    ),
    check(
      "events_category_valid",
      sql`${t.category} IN ('XCO','XCC','Reto','Autogestiva','Ruta')`,
    ),
  ],
);

export const eventProducts = pgTable(
  "event_products",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.productId] }),
    index("event_products_product_idx").on(t.productId),
  ],
);

export const catalogRequests = pgTable(
  "catalog_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestNumber: varchar("request_number", { length: 40 }).notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    kind: varchar("kind", { length: 20 }).notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    customProductName: varchar("custom_product_name", { length: 200 }),
    size: varchar("size", { length: 80 }),
    color: varchar("color", { length: 80 }),
    comments: text("comments"),
    quantity: integer("quantity").notNull(),
    fulfillment: varchar("fulfillment", { length: 20 }).notNull(),
    recipientName: varchar("recipient_name", { length: 200 }),
    shippingPhone: varchar("shipping_phone", { length: 20 }),
    street: varchar("street", { length: 300 }),
    neighborhood: varchar("neighborhood", { length: 200 }),
    city: varchar("city", { length: 150 }),
    state: varchar("state", { length: 150 }),
    postalCode: varchar("postal_code", { length: 10 }),
    shippingCarrier: varchar("shipping_carrier", { length: 30 }),
    status: varchar("status", { length: 20 }).default("submitted").notNull(),
    quotedPriceCents: integer("quoted_price_cents"),
    adminMessage: text("admin_message"),
    ...timestamps,
  },
  (t) => [
    index("catalog_requests_customer_idx").on(t.customerId, t.createdAt),
    index("catalog_requests_status_idx").on(t.status, t.createdAt),
    check("catalog_requests_quantity_positive", sql`${t.quantity} > 0`),
    check(
      "catalog_requests_price_nonnegative",
      sql`${t.quotedPriceCents} IS NULL OR ${t.quotedPriceCents} >= 0`,
    ),
    check(
      "catalog_requests_kind_valid",
      sql`${t.kind} IN ('quote','reservation')`,
    ),
    check(
      "catalog_requests_fulfillment_valid",
      sql`${t.fulfillment} IN ('store','event','shipping')`,
    ),
    check(
      "catalog_requests_product_present",
      sql`${t.productId} IS NOT NULL OR ${t.customProductName} IS NOT NULL`,
    ),
    check(
      "catalog_requests_event_fulfillment",
      sql`${t.fulfillment} <> 'event' OR ${t.eventId} IS NOT NULL`,
    ),
    check(
      "catalog_requests_shipping_details",
      sql`${t.fulfillment} <> 'shipping' OR (${t.recipientName} IS NOT NULL AND ${t.shippingPhone} IS NOT NULL AND ${t.street} IS NOT NULL AND ${t.neighborhood} IS NOT NULL AND ${t.city} IS NOT NULL AND ${t.state} IS NOT NULL AND ${t.postalCode} IS NOT NULL AND ${t.shippingCarrier} IS NOT NULL)`,
    ),
    check(
      "catalog_requests_shipping_carrier_valid",
      sql`${t.shippingCarrier} IS NULL OR ${t.shippingCarrier} IN ('DHL','FedEx','Estafeta','Paquetexpress','Otra')`,
    ),
    check(
      "catalog_requests_status_valid",
      sql`${t.status} IN ('submitted','reviewing','quoted','confirmed','unavailable','ready','completed','cancelled')`,
    ),
  ],
);
