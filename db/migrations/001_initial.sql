CREATE TABLE users (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  password text NOT NULL,
  role text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  total_creation integer NOT NULL DEFAULT 0 CHECK (total_creation >= 0),
  credits integer NOT NULL DEFAULT 20 CHECK (credits >= 0),
  reset_token text,
  reset_token_expires timestamptz,
  otp_hash text,
  otp_expires_in timestamptz,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_reset_token_idx ON users(reset_token) WHERE reset_token IS NOT NULL;

CREATE TABLE projects (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  initial_prompt text NOT NULL,
  current_code text,
  current_version_id text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_user_created_idx ON projects(user_id, created_at DESC);
CREATE INDEX projects_published_updated_idx ON projects(updated_at DESC) WHERE is_published;

CREATE TABLE project_versions (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (project_id, position)
);
ALTER TABLE projects ADD CONSTRAINT projects_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES project_versions(id)
  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE conversations (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (project_id, position)
);

CREATE TABLE payment_transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_id text NOT NULL CHECK (length(trim(plan_id)) > 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  credits integer NOT NULL CHECK (credits >= 0),
  is_paid boolean NOT NULL DEFAULT false,
  credits_applied boolean NOT NULL DEFAULT false,
  payment_status text NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Failed')),
  payment_provider text CHECK (payment_provider IN ('Stripe', 'Razorpay', 'Paypal')),
  payment_intent_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_created_idx ON payment_transactions(user_id, created_at DESC);
