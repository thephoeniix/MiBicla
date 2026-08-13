ALTER TABLE "events" ADD COLUMN "category" varchar(20) DEFAULT 'Ruta' NOT NULL;
ALTER TABLE "events" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "events" ADD COLUMN "map_url" text;
ALTER TABLE "events" ADD CONSTRAINT "events_category_valid" CHECK ("category" IN ('XCO','XCC','Reto','Autogestiva','Ruta'));

ALTER TABLE "catalog_requests" ADD COLUMN "recipient_name" varchar(200);
ALTER TABLE "catalog_requests" ADD COLUMN "shipping_phone" varchar(20);
ALTER TABLE "catalog_requests" ADD COLUMN "street" varchar(300);
ALTER TABLE "catalog_requests" ADD COLUMN "neighborhood" varchar(200);
ALTER TABLE "catalog_requests" ADD COLUMN "city" varchar(150);
ALTER TABLE "catalog_requests" ADD COLUMN "state" varchar(150);
ALTER TABLE "catalog_requests" ADD COLUMN "postal_code" varchar(10);
ALTER TABLE "catalog_requests" ADD COLUMN "shipping_carrier" varchar(30);
ALTER TABLE "catalog_requests" DROP CONSTRAINT "catalog_requests_fulfillment_valid";
ALTER TABLE "catalog_requests" ADD CONSTRAINT "catalog_requests_fulfillment_valid" CHECK ("fulfillment" IN ('store','event','shipping'));
ALTER TABLE "catalog_requests" ADD CONSTRAINT "catalog_requests_shipping_details" CHECK ("fulfillment" <> 'shipping' OR ("recipient_name" IS NOT NULL AND "shipping_phone" IS NOT NULL AND "street" IS NOT NULL AND "neighborhood" IS NOT NULL AND "city" IS NOT NULL AND "state" IS NOT NULL AND "postal_code" IS NOT NULL AND "shipping_carrier" IS NOT NULL));
ALTER TABLE "catalog_requests" ADD CONSTRAINT "catalog_requests_shipping_carrier_valid" CHECK ("shipping_carrier" IS NULL OR "shipping_carrier" IN ('DHL','FedEx','Estafeta','Paquetexpress','Otra'));
