# Teams and Roles API (Express Backend)

This backend includes team and role management with JWT-based authorization.

Prerequisites:
- Database is configured (see README_DB_SETUP.md)

Apply schema for users/teams/roles (idempotent):
- Users:
  psql "$POSTGRES_URL" -f ./src/db/bootstrap.sql
- Teams + role tables (no role_assignments table):
  psql "$POSTGRES_URL" -f ./src/db/bootstrap_teams.sql
- Ensure baseline roles exist (admin, manager, employee):
  psql "$POSTGRES_URL" -f ./src/db/bootstrap_roles.sql

Notes:
- Canonical soft-delete columns are deleted_at.
  - teams.deleted_at (was archived_at in older versions)
  - team_members.deleted_at (was removed_at in older versions)
- Team roles live on team_members:
  - team_members.team_role: enum-compatible values 'employee' | 'manager' | 'admin'
  - team_members.is_manager: boolean convenience flag
- Global admin comes from users.role = 'admin'. There is no role_assignments table in the canonical schema.

Security:
- Send Authorization: Bearer <JWT>.
- Global `admin` (from users.role) can create teams and manage all.
- Team managers/admins can manage their team members.
- Regular members can list/view teams they belong to.

Granting admin (one-time bootstrap):
Option A: Guarded endpoint (set ALLOW_BOOTSTRAP_ADMIN=true temporarily)
1) Start server with ALLOW_BOOTSTRAP_ADMIN=true in environment.
2) Grant admin by email:
   curl -s -X POST "http://localhost:3001/api/bootstrap/grant-admin" \
     -H "Content-Type: application/json" \
     -d '{"email":"alice@example.com"}' | jq .
   Or by userId:
   curl -s -X POST "http://localhost:3001/api/bootstrap/grant-admin" \
     -H "Content-Type: application/json" \
     -d '{"userId":"<uuid>"}' | jq .
3) Immediately set ALLOW_BOOTSTRAP_ADMIN=false after use.

Option B: SQL snippet (no endpoint needed)
psql "$POSTGRES_URL" <<'SQL'
-- Ensure admin role exists in catalog (optional)
INSERT INTO roles (name) VALUES ('admin') ON CONFLICT (name) DO NOTHING;
-- Set global admin on users table by email
UPDATE users SET role = 'admin', updated_at = NOW()
WHERE lower(email) = lower('alice@example.com') AND deleted_at IS NULL;
SQL

Example flow:

1) Login to get a token (see README_AUTH.md).
   TOKEN=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"Password123!"}' | jq -r .token)

2) Create a team (admin only):
   curl -s -X POST "http://localhost:3001/api/teams" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Engineering","description":"Product engineering team"}' | jq .

3) List my teams:
   curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/teams" | jq .

4) Add a member to team:
   curl -s -X POST "http://localhost:3001/api/teams/<teamId>/members" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"userId":"<userId>","role":"employee"}' | jq .

5) Change member role:
   curl -s -X PATCH "http://localhost:3001/api/teams/<teamId>/members/<userId>" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"role":"manager"}' | jq .

6) List members:
   curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/teams/<teamId>/members" | jq .

7) Soft delete a team:
   curl -s -X DELETE "http://localhost:3001/api/teams/<teamId>" \
     -H "Authorization: Bearer $TOKEN" | jq .

8) List available roles (catalog):
   curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/roles" | jq .

Notes:
- Soft-delete columns are deleted_at everywhere.
- Swagger docs: /docs; OpenAPI: /openapi.json
