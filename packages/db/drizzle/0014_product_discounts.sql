ALTER TABLE "products" ADD COLUMN "discount_percent" integer DEFAULT 0 NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_discount_percent_valid" CHECK ("discount_percent" BETWEEN 0 AND 100);
