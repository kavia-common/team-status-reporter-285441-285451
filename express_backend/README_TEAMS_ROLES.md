# Teams and Roles API (Express Backend)

This backend includes team and role management with JWT-based authorization.

Prerequisites:
- Database is configured (see README_DB_SETUP.md)

Apply schema for users/teams/roles (idempotent):
- Users:
  psql "$POSTGRES_URL" -f ./src/db/bootstrap.sql
- Teams + role tables:
  psql "$POSTGRES_URL" -f ./src/db/bootstrap_teams.sql
- Ensure baseline roles exist (admin, manager, member):
  psql "$POSTGRES_URL" -f ./src/db/bootstrap_roles.sql

Note:
- If you previously created the teams table without archived_at, re-run bootstrap_teams.sql. The script is idempotent and now adds missing soft-delete columns (teams.archived_at, team_members.removed_at, role_assignments.revoked_at) to existing databases.
- The roles list endpoint will be empty until roles are seeded. Run bootstrap_roles.sql above.

Security:
- Send Authorization: Bearer <JWT> header.
- Global `admin` (from users.role) can create teams and manage all.
- Team managers/admins can manage their team members and assignments.
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
3) Immediately remove or set ALLOW_BOOTSTRAP_ADMIN=false after use.

Option B: SQL snippet (no endpoint needed)
psql "$POSTGRES_URL" <<'SQL'
-- Ensure admin role exists
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
     -d '{"userId":"<userId>","role":"member"}' | jq .

5) Change member role:
   curl -s -X PATCH "http://localhost:3001/api/teams/<teamId>/members/<userId>" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"role":"manager"}' | jq .

6) List members:
   curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/teams/<teamId>/members" | jq .

7) Archive a team:
   curl -s -X DELETE "http://localhost:3001/api/teams/<teamId>" \
     -H "Authorization: Bearer $TOKEN" | jq .

8) List available roles:
   curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/roles" | jq .

9) Assign role (team-scoped):
   curl -s -X POST "http://localhost:3001/api/roles/assign" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"userId":"<userId>","teamId":"<teamId>","roleName":"manager"}' | jq .

10) Revoke role:
   curl -s -X DELETE "http://localhost:3001/api/roles/assign/<assignmentId>" \
     -H "Authorization: Bearer $TOKEN" | jq .

Notes:
- Soft-delete: teams use archived_at; team_members use removed_at; role_assignments use revoked_at.
- Swagger docs: /docs; OpenAPI: /openapi.json
