Auth endpoints quick reference:
/api/auth/register POST
Body: { "name":"Alice", "email":"alice@example.com", "password":"Password123!" }
201 -> { user, token }

/api/auth/login POST
Body: { "email":"alice@example.com", "password":"Password123!" }
200 -> { user, token }

Database table users expected columns:
- id (PK, UUID or serial)
- name (text)
- email (citext unique)
- password_hash (text)
- role (text or text[])
- created_at, updated_at (timestamptz), deleted_at (timestamptz nullable)

JWT usage:
- The token returned is a signed JWT containing { sub: user.id, email, role }.
- Send it in Authorization header as: Bearer <token>.
- Configure environment variable JWT_SECRET with a strong random value.
- Optional: JWT_EXPIRATION to override default '7d' expiry.
