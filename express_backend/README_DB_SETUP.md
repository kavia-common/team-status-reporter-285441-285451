# Database Setup for Express Backend

This backend expects a `users` table with soft-delete support (`deleted_at` column).
The code references `deleted_at IS NULL` during register and login.

## Required Environment Variables

Ensure the following environment variables are configured for the backend to connect to PostgreSQL (do not commit secrets; use your deployment environment or a `.env` file):

- POSTGRES_URL (preferred, must include username)
  - or the individual parts:
    - POSTGRES_HOST
    - POSTGRES_PORT
    - POSTGRES_USER
    - POSTGRES_PASSWORD
    - POSTGRES_DB
- Optional: POSTGRES_SSL (`true` to enable SSL with `rejectUnauthorized: false`)

Example `.env.example`:
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=appuser
POSTGRES_PASSWORD=apppassword
POSTGRES_DB=team_status
POSTGRES_SSL=false
BCRYPT_SALT_ROUNDS=10
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRATION=7d
PORT=3001
HOST=0.0.0.0
```

Note: Do not commit `.env` files with secrets. Provide to the runtime environment.

## Apply Schema

Run the SQL bootstrap script to create or update the `users` table schema:

```
psql "$POSTGRES_URL" -f ./src/db/bootstrap.sql
```

Also apply team/roles schema:

```
psql "$POSTGRES_URL" -f ./src/db/bootstrap_teams.sql
psql "$POSTGRES_URL" -f ./src/db/bootstrap_roles.sql
```

If you do not have `POSTGRES_URL`, build it from parts:
```
psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB" -f ./src/db/bootstrap.sql
```

What it does:
- Creates `users` table if missing with fields:
  - id (UUID, primary key), name, email (citext), password_hash, role, created_at, updated_at, deleted_at (nullable)
- Adds `deleted_at` column if missing (idempotent)
- Adds unique constraint on `email` (if missing)
- Sets up a trigger to auto-update `updated_at`
- Attempts to create `citext` and `pgcrypto` extensions if permitted (safe to ignore if lacking privileges)

If `citext` cannot be installed:
- The column will still be defined as `citext` if the extension existed when the table was created.
- Otherwise, consider switching `email` to `TEXT` and ensure inputs are normalized to lowercase (the code already lowercases the email value).

## Verify Register Endpoint

1. Start the backend:
```
npm run start
```

2. Call register:
```
curl -s -X POST "http://localhost:3001/api/auth/register" \
 -H "Content-Type: application/json" \
 -d '{"name":"Alice Example","email":"alice@example.com","password":"Password123!"}' \
 | jq .
```

Expected response: HTTP 201 with JSON:
```
{
  "user": { "id": "...", "name": "Alice Example", "email": "alice@example.com", "role": "user", "created_at": "...", "updated_at": "..." },
  "token": "TOKEN_PLACEHOLDER"
}
```

If you receive a 409 on second try, that is expected due to the unique email constraint.

## Notes

- The application uses soft delete semantics by filtering on `deleted_at IS NULL`. Ensure your `users` table includes `deleted_at TIMESTAMPTZ NULL`.
- The login and registration endpoints are documented at `/docs` and the OpenAPI JSON at `/openapi.json`.
