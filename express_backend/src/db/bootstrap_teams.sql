-- Bootstrap SQL for teams and team_members aligned to canonical schema (no role_assignments).
-- Idempotent creation, soft-delete via deleted_at columns.

-- Ensure extensions for UUID if possible
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

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Backfill/normalize deleted_at if legacy archived_at exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'archived_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'deleted_at') THEN
    ALTER TABLE teams ADD COLUMN deleted_at TIMESTAMPTZ NULL;
    UPDATE teams SET deleted_at = archived_at WHERE deleted_at IS NULL;
    ALTER TABLE teams DROP COLUMN archived_at;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'deleted_at') THEN
    ALTER TABLE teams ADD COLUMN deleted_at TIMESTAMPTZ NULL;
  END IF;
END$$;

-- Auto-update updated_at for teams
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_teams_updated_at') THEN
    CREATE TRIGGER set_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- team_members table (membership with role at team scope)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_role TEXT NOT NULL DEFAULT 'employee', -- enum-compatible: employee | manager | admin
  is_manager BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  UNIQUE (team_id, user_id)
);

-- Migrate/normalize columns if legacy schema exists
DO $$
BEGIN
  -- Add id if missing (legacy composite PK)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'id') THEN
    ALTER TABLE team_members ADD COLUMN id UUID;
    UPDATE team_members SET id = gen_random_uuid() WHERE id IS NULL;
    ALTER TABLE team_members ADD PRIMARY KEY (id);
    -- Maintain uniqueness
    DO $do$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_team_user_key') THEN
        ALTER TABLE team_members ADD CONSTRAINT team_members_team_user_key UNIQUE (team_id, user_id);
      END IF;
    END
    $do$;
  END IF;

  -- Rename legacy role to team_role
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'role')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'team_role') THEN
    ALTER TABLE team_members ADD COLUMN team_role TEXT;
    UPDATE team_members SET team_role = LOWER(COALESCE(role, 'employee'));
    ALTER TABLE team_members DROP COLUMN role;
  END IF;

  -- Add is_manager if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'is_manager') THEN
    ALTER TABLE team_members ADD COLUMN is_manager BOOLEAN NOT NULL DEFAULT FALSE;
    UPDATE team_members SET is_manager = (team_role IN ('manager','admin'));
  END IF;

  -- Normalize soft-delete column removed_at -> deleted_at
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'removed_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'deleted_at') THEN
    ALTER TABLE team_members ADD COLUMN deleted_at TIMESTAMPTZ NULL;
    UPDATE team_members SET deleted_at = removed_at WHERE deleted_at IS NULL;
    ALTER TABLE team_members DROP COLUMN removed_at;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'deleted_at') THEN
    ALTER TABLE team_members ADD COLUMN deleted_at TIMESTAMPTZ NULL;
  END IF;

  -- Backfill defaults for team_role
  UPDATE team_members SET team_role = 'employee' WHERE team_role IS NULL;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_team_members_updated_at') THEN
    CREATE TRIGGER set_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- roles table (catalog of roles)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- e.g., admin, manager, employee
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed common roles if not present (enum-compatible values)
INSERT INTO roles (name, description)
SELECT r, INITCAP(r) || ' role'
FROM (VALUES ('admin'), ('manager'), ('employee')) AS v(r)
ON CONFLICT (name) DO NOTHING;
