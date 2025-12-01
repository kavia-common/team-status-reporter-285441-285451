'use strict';

const jwt = require('jsonwebtoken');

const DEFAULT_EXPIRY = process.env.JWT_EXPIIRATION || process.env.JWT_EXPIRATION || '7d';
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Ensure JWT secret exists in environment.
 * We do not throw at module load to allow app to boot and show helpful error
 * responses at runtime. Callers should handle missing secret gracefully.
 */
function assertSecret() {
  if (!JWT_SECRET) {
    const e = new Error('JWT_SECRET not configured. Set JWT_SECRET in environment.');
    e.status = 500;
    throw e;
  }
}

// PUBLIC_INTERFACE
function signToken(payload, options = {}) {
  /** Sign a JWT with the configured secret.
   * Payload: object containing public user claims (e.g., { sub, email, role })
   * Options: jsonwebtoken sign options; default expiresIn from env or 7d.
   * Returns: string (JWT)
   */
  assertSecret();
  const opts = { expiresIn: DEFAULT_EXPIRY, ...options };
  return jwt.sign(payload, JWT_SECRET, opts);
}

// PUBLIC_INTERFACE
function verifyToken(token) {
  /** Verify a JWT and return decoded payload. Throws on invalid token. */
  assertSecret();
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  signToken,
  verifyToken,
};
