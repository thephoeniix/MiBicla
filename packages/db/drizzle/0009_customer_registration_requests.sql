CREATE TABLE customer_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id varchar(64) NOT NULL UNIQUE,
  public_reference varchar(16) NOT NULL UNIQUE,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  phone_normalized varchar(20) NOT NULL,
  email varchar(254),
  password_hash varchar(255),
  status varchar(20) NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  decided_by uuid REFERENCES administrators(id) ON DELETE SET NULL,
  decided_at timestamptz,
  rejection_reason varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_registration_requests_status CHECK (status IN ('pending','approved','rejected','expired')),
  CONSTRAINT customer_registration_requests_expiry CHECK (expires_at > created_at)
);
CREATE INDEX customer_registration_requests_status_idx ON customer_registration_requests(status, created_at);
CREATE INDEX customer_registration_requests_phone_idx ON customer_registration_requests(phone_normalized);
CREATE UNIQUE INDEX customer_registration_requests_pending_phone_idx
  ON customer_registration_requests(phone_normalized) WHERE status = 'pending';
