'use strict';

const pool = require('../db/pool');

/**
 * Utility helpers for one-time bootstrap actions, guarded by env flags.
 */
class BootstrapController {
  // PUBLIC_INTERFACE
  /**
   * Grant global admin to a user by id or email.
   * Requires env ALLOW_BOOTSTRAP_ADMIN=true. This route is not authenticated by design,
   * but strictly guarded by the environment flag to avoid accidental exposure.
   *
   * Body:
   *  - userId?: string (uuid)
   *  - email?: string (string email)
   *
   * Process:
   *  - If email provided, resolve to user id (only non-deleted).
   *  - Update users.role = 'admin' for target user.
   *  - Also ensure roles table contains 'admin' (defensive).
   *
   * Returns:
   *  - { user: { id, name, email, role } }
   */
  async grantAdmin(req, res) {
    try {
      if (process.env.ALLOW_BOOTSTRAP_ADMIN !== 'true') {
        return res.status(403).json({ error: 'Forbidden. Set ALLOW_BOOTSTRAP_ADMIN=true to enable this endpoint temporarily.' });
      }
      const { userId, email } = req.body || {};
      if (!userId && !email) {
        return res.status(400).json({ error: 'Provide userId or email.' });
      }
      let targetId = userId || null;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (!targetId) {
          const find = await client.query(
            'SELECT id FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1',
            [email]
          );
          if (find.rows.length === 0) {
            const e = new Error('User not found for provided email.');
            e.status = 404;
            throw e;
          }
          targetId = find.rows[0].id;
        }

        // Ensure roles has 'admin'
        await client.query('INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', ['admin']);

        // Update users table: set role to 'admin'
        const upd = await client.query(
          'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id, name, email, role',
          ['admin', targetId]
        );
        if (upd.rows.length === 0) {
          const e = new Error('User not found or soft deleted.');
          e.status = 404;
          throw e;
        }

        await client.query('COMMIT');
        return res.status(200).json({ user: upd.rows[0] });
      } catch (err) {
        await client.query('ROLLBACK');
        const status = err.status || 500;
        return res.status(status).json({ error: err.message || 'Internal Server Error' });
      } finally {
        client.release();
      }
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ error: err.message || 'Internal Server Error' });
    }
  }
}

module.exports = new BootstrapController();
