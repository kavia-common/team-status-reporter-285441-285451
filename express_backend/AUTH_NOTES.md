# JWT Authentication

This backend issues real JWTs for register and login.

- Token payload includes: { sub: user.id, email, role }
- Default expiration: 7d (override with JWT_EXPIRATION)
- Configure secret via environment:
  - JWT_SECRET=replace-with-a-long-random-string

Usage:
- Send with each request:
  Authorization: Bearer <token>

Middleware:
- Use `authenticate` from `src/middleware/auth.js` to protect routes:
  ```js
  const { authenticate } = require('../middleware');
  router.get('/protected', authenticate, (req, res) => {
    res.json({ user: req.user });
  });
  ```
