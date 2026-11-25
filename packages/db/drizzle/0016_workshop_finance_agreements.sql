ALTER TABLE "customers" ADD COLUMN "credit_limit_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_credit_limit_nonnegative" CHECK ("credit_limit_cents" >= 0);

CREATE TABLE "teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "administrators"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "administrators"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "teams_name_unique" ON "teams" (lower("name"));

CREATE TABLE "agreements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE RESTRICT,
  "discount_type" varchar(20) NOT NULL,
  "value" integer NOT NULL,
  "valid_from" date NOT NULL,
  "valid_until" date,
  "conditions" text,
  "active" boolean DEFAULT true NOT NULL,
  "combinable" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "administrators"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "administrators"("id") ON DELETE SET NULL,
  CONSTRAINT "agreements_type" CHECK ("discount_type" IN ('percentage','fixed')),
  CONSTRAINT "agreements_value" CHECK ("value" > 0 AND ("discount_type" <> 'percentage' OR "value" <= 10000)),
  CONSTRAINT "agreements_validity" CHECK ("valid_until" IS NULL OR "valid_until" >= "valid_from")
);
CREATE INDEX "agreements_team_idx" ON "agreements" ("team_id");

CREATE TABLE "customer_team_affiliations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE RESTRICT,
  "proposed_team_name" varchar(200),
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "verification_date" timestamptz,
  "evidence_note" text,
  "verified_by" uuid REFERENCES "administrators"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "customer_team_affiliations_status" CHECK ("status" IN ('pending','verified','rejected','expired')),
  CONSTRAINT "customer_team_affiliations_team" CHECK (num_nonnulls("team_id", "proposed_team_name") = 1)
);
CREATE INDEX "customer_team_affiliations_customer_idx" ON "customer_team_affiliations" ("customer_id");
CREATE UNIQUE INDEX "customer_team_affiliations_current_unique" ON "customer_team_affiliations" ("customer_id") WHERE "status" IN ('pending','verified');

CREATE TABLE "workshop_order_agreement_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workshop_order_id" uuid NOT NULL REFERENCES "workshop_orders"("id") ON DELETE RESTRICT,
  "agreement_id" uuid NOT NULL REFERENCES "agreements"("id") ON DELETE RESTRICT,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE RESTRICT,
  "team_name" varchar(200) NOT NULL,
  "discount_type" varchar(20) NOT NULL,
  "agreement_value" integer NOT NULL,
  "discount_cents" integer NOT NULL,
  "conditions" text,
  "combinable" boolean NOT NULL,
  "applied_by" uuid REFERENCES "administrators"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "workshop_order_agreement_discount" CHECK ("discount_cents" > 0),
  CONSTRAINT "workshop_order_agreement_unique" UNIQUE ("workshop_order_id")
);

CREATE TABLE "workshop_financial_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workshop_order_id" uuid NOT NULL REFERENCES "workshop_orders"("id") ON DELETE RESTRICT,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "type" varchar(30) NOT NULL,
  "amount_cents" integer NOT NULL,
  "payment_method" varchar(30),
  "reference" varchar(300),
  "note" text,
  "occurred_date" date NOT NULL,
  "responsible_admin_id" uuid REFERENCES "administrators"("id") ON DELETE RESTRICT,
  "corrected_movement_id" uuid REFERENCES "workshop_financial_movements"("id") ON DELETE RESTRICT,
  "agreement_application_id" uuid REFERENCES "workshop_order_agreement_applications"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "workshop_financial_movement_type" CHECK ("type" IN ('advance','payment','discount','credit_applied','charge','refund','correction')),
  CONSTRAINT "workshop_financial_movement_amount" CHECK ("amount_cents" <> 0),
  CONSTRAINT "workshop_financial_payment_method" CHECK ("payment_method" IS NULL OR "payment_method" IN ('cash','card','transfer','customer_credit','agreement','other')),
  CONSTRAINT "workshop_financial_other_note" CHECK ("payment_method" <> 'other' OR length(trim(coalesce("note", ''))) > 0),
  CONSTRAINT "workshop_financial_correction_link" CHECK (("type" = 'correction') = ("corrected_movement_id" IS NOT NULL))
);
CREATE INDEX "workshop_financial_movements_order_idx" ON "workshop_financial_movements" ("workshop_order_id", "created_at");
CREATE INDEX "workshop_financial_movements_customer_idx" ON "workshop_financial_movements" ("customer_id", "created_at");
CREATE UNIQUE INDEX "workshop_financial_movement_reversal_unique" ON "workshop_financial_movements" ("corrected_movement_id") WHERE "corrected_movement_id" IS NOT NULL;

CREATE FUNCTION validate_workshop_financial_correction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original workshop_financial_movements%ROWTYPE;
BEGIN
  IF NEW.type <> 'correction' THEN RETURN NEW; END IF;
  SELECT * INTO original FROM workshop_financial_movements WHERE id = NEW.corrected_movement_id FOR UPDATE;
  IF NOT FOUND OR original.type = 'correction'
    OR original.workshop_order_id <> NEW.workshop_order_id
    OR original.customer_id <> NEW.customer_id
    OR NEW.amount_cents <> -original.amount_cents THEN
    RAISE EXCEPTION 'correction must fully reverse one original movement';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "workshop_financial_movements_validate_correction" BEFORE INSERT ON "workshop_financial_movements" FOR EACH ROW EXECUTE FUNCTION validate_workshop_financial_correction();

-- Preserve identified legacy values as immutable opening import movements.
INSERT INTO "workshop_financial_movements" ("workshop_order_id", "customer_id", "type", "amount_cents", "payment_method", "note", "occurred_date", "responsible_admin_id")
SELECT "id", "customer_id", 'payment', "amount_paid_cents", 'other', 'Importación de saldo pagado previo a la bitácora', "created_at"::date, "created_by"
FROM "workshop_orders" WHERE "amount_paid_cents" > 0;
INSERT INTO "workshop_financial_movements" ("workshop_order_id", "customer_id", "type", "amount_cents", "payment_method", "note", "occurred_date", "responsible_admin_id")
SELECT "id", "customer_id", 'discount', "discount_cents", 'other', 'Importación de descuento previo a la bitácora', "created_at"::date, "created_by"
FROM "workshop_orders" WHERE "discount_cents" > 0;

CREATE FUNCTION reject_workshop_financial_movement_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'workshop financial movements are immutable';
END $$;
CREATE TRIGGER "workshop_financial_movements_no_update" BEFORE UPDATE ON "workshop_financial_movements" FOR EACH ROW EXECUTE FUNCTION reject_workshop_financial_movement_mutation();
CREATE TRIGGER "workshop_financial_movements_no_delete" BEFORE DELETE ON "workshop_financial_movements" FOR EACH ROW EXECUTE FUNCTION reject_workshop_financial_movement_mutation();

INSERT INTO "permissions" ("name", "description") VALUES
  ('manage_workshop_pricing', 'Modificar precios y descuentos de taller'),
  ('manage_workshop_agreements', 'Administrar equipos, convenios y afiliaciones'),
  ('manage_customer_financing', 'Administrar límites de crédito individual')
ON CONFLICT ("name") DO NOTHING;
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" IN ('owner','admin') AND p."name" IN ('manage_workshop_pricing','manage_workshop_agreements','manage_customer_financing')
ON CONFLICT DO NOTHING;
