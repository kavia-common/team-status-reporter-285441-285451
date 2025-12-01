-- Bootstrap SQL for seeding baseline roles (enum-compatible).
-- This script is idempotent.

-- Ensure UUID generation available if needed
DO $$
BEGIN
  PERFORM gen_random_uuid();
EXCEPTION WHEN undefined_function THEN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pgcrypto extension could not be created (insufficient privileges).';
  END;
END$$;

-- Ensure roles table exists
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed baseline roles: admin, manager, employee
INSERT INTO roles (name, description)
SELECT r, INITCAP(r) || ' role'
FROM (VALUES ('admin'), ('manager'), ('employee')) AS v(r)
ON CONFLICT (name) DO NOTHING;
