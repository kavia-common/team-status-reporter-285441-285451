'use strict';

const { verifyToken } = require('../utils/jwt');

// PUBLIC_INTERFACE
function authenticate(req, res, next) {
  /** Express middleware to verify Bearer token and populate req.user.
   * Reads Authorization: Bearer <token>.
   * On success, sets req.user to decoded payload. On failure, responds 401.
   */
  const header = req.get('authorization') || req.get('Authorization') || '';
  const parts = header.split(' ');
  const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header.' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = {
  authenticate,
};
