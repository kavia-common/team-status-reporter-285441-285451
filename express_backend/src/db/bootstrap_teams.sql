-- Bootstrap SQL for teams, team_members, roles and role_assignments.
-- Idempotent creation, aligned for soft-delete support via archived_at/deleted_at.

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
  archived_at TIMESTAMPTZ NULL
);

-- Ensure archived_at exists if teams table pre-existed without it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'teams'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE teams ADD COLUMN archived_at TIMESTAMPTZ NULL;
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
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- member | manager | admin (scoped)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (team_id, user_id)
);

-- Ensure removed_at exists if team_members pre-existed without it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'team_members'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'removed_at'
  ) THEN
    ALTER TABLE team_members ADD COLUMN removed_at TIMESTAMPTZ NULL;
  END IF;
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
  name TEXT UNIQUE NOT NULL, -- e.g., admin, manager, member, viewer, reporter
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed common roles if not present
INSERT INTO roles (name, description)
SELECT r, INITCAP(r) || ' role'
FROM (VALUES ('admin'), ('manager'), ('member')) AS v(r)
ON CONFLICT (name) DO NOTHING;

-- role_assignments table (explicit role grants at team-scope, may overlap with team_members.role)
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NULL REFERENCES teams(id) ON DELETE CASCADE, -- NULL for global role if needed later
  role_name TEXT NOT NULL, -- references roles(name) by convention
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL
);

-- Ensure revoked_at exists if role_assignments pre-existed without it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'role_assignments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'role_assignments' AND column_name = 'revoked_at'
  ) THEN
    ALTER TABLE role_assignments ADD COLUMN revoked_at TIMESTAMPTZ NULL;
  END IF;
END$$;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_role_assignments_user_team
  ON role_assignments(user_id, team_id)
  WHERE revoked_at IS NULL;

-- Optional: enforce team_members and role_assignments consistency left to application logic.
