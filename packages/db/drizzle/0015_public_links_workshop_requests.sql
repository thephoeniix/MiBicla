CREATE TABLE "public_links" (
  "id" uuid PRIMARY KEY NOT NULL,
  "purpose" varchar(40) NOT NULL,
  "code_hash" varchar(64) NOT NULL UNIQUE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE CASCADE,
  "workshop_order_id" uuid REFERENCES "workshop_orders"("id") ON DELETE CASCADE,
  "workshop_request_id" uuid REFERENCES "workshop_requests"("id") ON DELETE CASCADE,
  "customer_auth_token_id" uuid REFERENCES "customer_auth_tokens"("id") ON DELETE CASCADE,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz,
  "last_used_at" timestamptz,
  "consumed_at" timestamptz,
  "revoked_at" timestamptz,
  CONSTRAINT "public_links_purpose" CHECK ("purpose" IN ('workshop_tracking','customer_activation','customer_verification','password_recovery','customer_card','workshop_request')),
  CONSTRAINT "public_links_status" CHECK ("status" IN ('active','consumed','revoked')),
  CONSTRAINT "public_links_expiry" CHECK ("expires_at" IS NULL OR "expires_at" > "created_at"),
  CONSTRAINT "public_links_single_resource" CHECK (num_nonnulls("customer_id", "workshop_order_id", "workshop_request_id", "customer_auth_token_id") = 1)
);
CREATE INDEX "public_links_order_idx" ON "public_links" ("workshop_order_id");
CREATE INDEX "public_links_request_idx" ON "public_links" ("workshop_request_id");
CREATE INDEX "public_links_customer_idx" ON "public_links" ("customer_id");
CREATE INDEX "public_links_auth_token_idx" ON "public_links" ("customer_auth_token_id");
CREATE UNIQUE INDEX "public_links_active_order_unique" ON "public_links" ("purpose", "workshop_order_id") WHERE "status" = 'active' AND "workshop_order_id" IS NOT NULL;
CREATE UNIQUE INDEX "public_links_active_request_unique" ON "public_links" ("purpose", "workshop_request_id") WHERE "status" = 'active' AND "workshop_request_id" IS NOT NULL;
CREATE UNIQUE INDEX "public_links_active_customer_unique" ON "public_links" ("purpose", "customer_id") WHERE "status" = 'active' AND "customer_id" IS NOT NULL;

ALTER TABLE "workshop_requests" ADD COLUMN "bike_color" text;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_wheel_size" text;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_year" integer;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_brake_type" text;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_suspension_type" text;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_drivetrain" text;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_general_condition" text;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_serial_number" text;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_frame_number" text;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_notes" text;
ALTER TABLE "workshop_requests" ADD COLUMN "bike_accessories" text;
ALTER TABLE "workshop_requests" ADD COLUMN "catalog_service_id" uuid REFERENCES "workshop_service_catalog"("id") ON DELETE SET NULL;
ALTER TABLE "workshop_requests" ADD COLUMN "service_name" text;
ALTER TABLE "workshop_requests" ADD COLUMN "symptoms" text;
ALTER TABLE "workshop_requests" ADD COLUMN "visible_damage" text;
ALTER TABLE "workshop_requests" ADD COLUMN "additional_comments" text;
ALTER TABLE "workshop_requests" ADD COLUMN "requested_date" date;
ALTER TABLE "workshop_requests" ADD COLUMN "requested_time" varchar(20);
ALTER TABLE "workshop_requests" ADD COLUMN "desired_delivery_date" date;
ALTER TABLE "workshop_requests" ADD COLUMN "urgency" varchar(20);
ALTER TABLE "workshop_requests" ADD COLUMN "updated_at" timestamptz DEFAULT now() NOT NULL;
CREATE INDEX "workshop_requests_requested_date_idx" ON "workshop_requests" ("requested_date") WHERE "requested_date" IS NOT NULL;

ALTER TABLE "workshop_settings" ADD COLUMN "schedule_timezone" varchar(64) DEFAULT 'America/Mexico_City' NOT NULL;
ALTER TABLE "workshop_settings" ADD COLUMN "minimum_notice_minutes" integer DEFAULT 120 NOT NULL;
ALTER TABLE "workshop_settings" ADD COLUMN "booking_horizon_days" integer DEFAULT 30 NOT NULL;
ALTER TABLE "workshop_settings" ADD COLUMN "daily_capacity" integer;
ALTER TABLE "workshop_settings" ADD COLUMN "schedule" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "workshop_settings" ADD CONSTRAINT "workshop_schedule_values" CHECK ("minimum_notice_minutes" >= 0 AND "booking_horizon_days" > 0 AND ("daily_capacity" IS NULL OR "daily_capacity" > 0));
