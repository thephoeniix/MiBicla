CREATE TABLE "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text NOT NULL,
  "category" varchar(100) NOT NULL,
  "image_url" text,
  "price_cents" integer,
  "sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "availability" varchar(20) DEFAULT 'available' NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "products_price_nonnegative" CHECK ("price_cents" IS NULL OR "price_cents" >= 0),
  CONSTRAINT "products_availability_valid" CHECK ("availability" IN ('available','on_request','unavailable'))
);
CREATE INDEX "products_public_idx" ON "products" ("is_published", "category");

CREATE TABLE "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  "location" varchar(300) NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone,
  "image_url" text,
  "is_published" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "events_date_order" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);
CREATE INDEX "events_public_idx" ON "events" ("is_published", "starts_at");

CREATE TABLE "event_products" (
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "event_products_event_id_product_id_pk" PRIMARY KEY("event_id", "product_id")
);
CREATE INDEX "event_products_product_idx" ON "event_products" ("product_id");

CREATE TABLE "catalog_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_number" varchar(40) NOT NULL UNIQUE,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "kind" varchar(20) NOT NULL,
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL,
  "custom_product_name" varchar(200),
  "size" varchar(80),
  "color" varchar(80),
  "comments" text,
  "quantity" integer NOT NULL,
  "fulfillment" varchar(20) NOT NULL,
  "status" varchar(20) DEFAULT 'submitted' NOT NULL,
  "quoted_price_cents" integer,
  "admin_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "catalog_requests_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "catalog_requests_price_nonnegative" CHECK ("quoted_price_cents" IS NULL OR "quoted_price_cents" >= 0),
  CONSTRAINT "catalog_requests_kind_valid" CHECK ("kind" IN ('quote','reservation')),
  CONSTRAINT "catalog_requests_fulfillment_valid" CHECK ("fulfillment" IN ('store','event')),
  CONSTRAINT "catalog_requests_product_present" CHECK ("product_id" IS NOT NULL OR "custom_product_name" IS NOT NULL),
  CONSTRAINT "catalog_requests_event_fulfillment" CHECK ("fulfillment" <> 'event' OR "event_id" IS NOT NULL),
  CONSTRAINT "catalog_requests_status_valid" CHECK ("status" IN ('submitted','reviewing','quoted','confirmed','unavailable','ready','completed','cancelled'))
);
CREATE INDEX "catalog_requests_customer_idx" ON "catalog_requests" ("customer_id", "created_at");
CREATE INDEX "catalog_requests_status_idx" ON "catalog_requests" ("status", "created_at");

INSERT INTO "permissions" ("name", "description") VALUES ('manage_catalog_requests', 'Gestionar solicitudes y cotizaciones de catálogo') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
WHERE r.name IN ('owner', 'admin') AND p.name = 'manage_catalog_requests'
ON CONFLICT DO NOTHING;
