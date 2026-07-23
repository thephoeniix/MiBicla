CREATE TABLE "workshop_service_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "suggested_price_cents" integer DEFAULT 0 NOT NULL,
  "estimated_duration_minutes" integer,
  "is_customer_visible" boolean DEFAULT true NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "workshop_service_catalog_values" CHECK ("suggested_price_cents" >= 0 AND ("estimated_duration_minutes" IS NULL OR "estimated_duration_minutes" > 0))
);
ALTER TABLE "workshop_service_catalog" ADD CONSTRAINT "workshop_service_catalog_created_by_administrators_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."administrators"("id") ON DELETE set null;
ALTER TABLE "workshop_service_catalog" ADD CONSTRAINT "workshop_service_catalog_updated_by_administrators_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."administrators"("id") ON DELETE set null;
CREATE INDEX "workshop_service_catalog_active_idx" ON "workshop_service_catalog" USING btree ("is_active","sort_order");
ALTER TABLE "workshop_order_services" ADD COLUMN "catalog_service_id" uuid;
ALTER TABLE "workshop_order_services" ADD CONSTRAINT "workshop_order_services_catalog_service_id_workshop_service_catalog_id_fk" FOREIGN KEY ("catalog_service_id") REFERENCES "public"."workshop_service_catalog"("id") ON DELETE restrict;

INSERT INTO "workshop_service_catalog" ("name", "sort_order") VALUES
  ('Parchado de llanta', 10),
  ('Instalación tubeless', 20),
  ('Rellenado de líquido tubeless', 30),
  ('Bike wash', 40),
  ('Servicio preventivo', 50),
  ('Servicio completo', 60);
