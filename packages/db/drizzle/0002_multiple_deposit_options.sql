ALTER TABLE payment_deposit_settings RENAME TO payment_deposit_options;
DROP INDEX payment_deposit_business_unique;
ALTER TABLE payment_deposit_options ADD COLUMN display_name text;
UPDATE payment_deposit_options SET display_name = COALESCE(NULLIF(bank_name, ''), 'Opción de depósito');
ALTER TABLE payment_deposit_options ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE payment_deposit_options ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX payment_deposit_options_business_idx ON payment_deposit_options(business_settings_id);
CREATE INDEX payment_deposit_options_active_idx ON payment_deposit_options(is_active);
CREATE INDEX payment_deposit_options_sort_idx ON payment_deposit_options(sort_order);
