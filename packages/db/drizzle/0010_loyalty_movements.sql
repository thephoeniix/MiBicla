CREATE TABLE "customer_loyalty_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "units" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "reason" varchar(500) NOT NULL,
  "movement_type" varchar(30) DEFAULT 'manual_adjustment' NOT NULL,
  "created_by" uuid REFERENCES "administrators"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "loyalty_movements_customer_idx" ON "customer_loyalty_movements" ("customer_id", "created_at");
