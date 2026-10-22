-- Run AFTER schema installation as the database/table owner with CREATEROLE.
-- Use a transaction: psql -v ON_ERROR_STOP=1 --single-transaction -f db/dcl/roles.sql
-- Roles are cluster-wide groups. No login accounts/passwords are created here.
-- These roles are reserved for this application; do not reuse privileged roles.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kalpriti_runtime') THEN
    CREATE ROLE kalpriti_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kalpriti_readonly') THEN
    CREATE ROLE kalpriti_readonly NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO kalpriti_runtime, kalpriti_readonly', current_database());
END
$roles$;

-- DDL is performed separately by the migration owner, never the runtime group.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM kalpriti_runtime, kalpriti_readonly;
GRANT USAGE ON SCHEMA public TO kalpriti_runtime, kalpriti_readonly;

REVOKE ALL PRIVILEGES ON TABLE public.users, public.projects, public.project_versions,
  public.conversations, public.payment_transactions, public.schema_migrations
FROM PUBLIC, kalpriti_runtime, kalpriti_readonly;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users, public.projects,
  public.project_versions, public.conversations, public.payment_transactions
TO kalpriti_runtime;

GRANT SELECT ON TABLE public.projects, public.project_versions,
  public.conversations, public.payment_transactions, public.schema_migrations
TO kalpriti_readonly;
-- Column grants exclude password hashes, password-reset tokens, and OTP hashes.
GRANT SELECT (id, name, email, role, total_creation, credits, verified, created_at, updated_at)
ON TABLE public.users TO kalpriti_readonly;

-- Membership examples: provision LOGIN accounts through your host/secret manager.
-- GRANT kalpriti_runtime TO your_application_login;
-- GRANT kalpriti_readonly TO your_reporting_login;
-- REVOKE kalpriti_readonly FROM your_reporting_login;
-- Passwords intentionally do not appear in this SQL file.
-- Re-run after migrations that add tables; grants are explicit, not automatic.
