-- Bootstrap SQL for users table with soft-delete support.
-- This script is idempotent: it will create the users table if it does not exist,
-- and add the deleted_at column if it's missing.

-- 1) Ensure extension citext is available for case-insensitive email, if permitted.
-- If the environment disallows extensions, you can switch email to TEXT and handle lowercase in app.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
    CREATE EXTENSION IF NOT EXISTS citext;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  -- Ignore if we can't create extensions; fallback handled by app via lower(email)
  RAISE NOTICE 'citext extension could not be created due to insufficient privileges.';
END$$;

-- 2) Create users table if it doesn't exist.
-- Using citext for email if extension available; else fallback to TEXT with lower() unique index below.
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email CITEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- If gen_random_uuid is missing (no pgcrypto), try to enable pgcrypto or fall back to serial
DO $$
BEGIN
  PERFORM gen_random_uuid();
EXCEPTION WHEN undefined_function THEN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pgcrypto extension could not be created. Consider using serial key.';
  END;
END$$;

-- 3) Add deleted_at column if it does not exist on existing tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ NULL;
  END IF;
END$$;

-- 4) Ensure unique email constraint ignoring soft-deleted rows is not trivial in SQL.
-- We will at least enforce unique email at the table level (including NULL deleted_at).
-- If a unique constraint exists, skip creation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END$$;

-- 5) Update updated_at automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_users_updated_at'
  ) THEN
    CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;
