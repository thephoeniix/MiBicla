CREATE TABLE customer_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  phone_normalized varchar(20) NOT NULL UNIQUE,
  password_hash varchar(255),
  status varchar(20) NOT NULL DEFAULT 'pending',
  activated_at timestamptz,
  password_changed_at timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_credentials_status CHECK (status IN ('pending', 'active', 'disabled')),
  CONSTRAINT customer_credentials_failed_nonnegative CHECK (failed_login_count >= 0)
);
CREATE INDEX customer_credentials_status_idx ON customer_credentials(status);

CREATE TABLE customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES customer_credentials(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  csrf_token_hash varchar(64) NOT NULL,
  ip_address varchar(45),
  user_agent varchar(500),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_sessions_expiry_order CHECK (expires_at <= absolute_expires_at),
  CONSTRAINT customer_sessions_revoked_order CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX customer_sessions_credential_idx ON customer_sessions(credential_id);
CREATE INDEX customer_sessions_active_idx ON customer_sessions(absolute_expires_at) WHERE revoked_at IS NULL;

CREATE TABLE customer_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES customer_credentials(id) ON DELETE CASCADE,
  purpose varchar(20) NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES administrators(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_auth_tokens_purpose CHECK (purpose IN ('activation', 'recovery')),
  CONSTRAINT customer_auth_tokens_expiry CHECK (expires_at > created_at)
);
CREATE INDEX customer_auth_tokens_credential_idx ON customer_auth_tokens(credential_id, purpose);
CREATE INDEX customer_auth_tokens_active_idx ON customer_auth_tokens(token_hash, expires_at) WHERE consumed_at IS NULL AND revoked_at IS NULL;
