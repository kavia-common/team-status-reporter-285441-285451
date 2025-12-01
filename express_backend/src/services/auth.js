'use strict';

const bcrypt = require('bcrypt');
const pool = require('../db/pool');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

// PUBLIC_INTERFACE
async function registerUser({ name, email, password }) {
  /** Register a new user: validates, hashes password, inserts row.
   * Returns: { user, token } where token is a placeholder for now.
   */
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    const err = new Error('Name must be at least 2 characters.');
    err.status = 400;
    throw err;
  }
  if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const err = new Error('A valid email is required.');
    err.status = 400;
    throw err;
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email exists (citext unique on DB should enforce; we check to return 409)
    const checkRes = await client.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
      [normalizedEmail]
    );
    if (checkRes.rows.length > 0) {
      const err = new Error('Email already in use.');
      err.status = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const insertRes = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at, updated_at`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = insertRes.rows[0];
    const token = 'TOKEN_PLACEHOLDER'; // Replace with JWT when implemented

    return { user, token };
  } finally {
    client.release();
  }
}

// PUBLIC_INTERFACE
async function loginUser({ email, password }) {
  /** Login user: validates credentials and returns user+token placeholder. */
  if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const err = new Error('A valid email is required.');
    err.status = 400;
    throw err;
  }
  if (!password || typeof password !== 'string') {
    const err = new Error('Password is required.');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const res = await pool.query(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
    [normalizedEmail]
  );
  if (res.rows.length === 0) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }
  const userRow = res.rows[0];
  const ok = await bcrypt.compare(password, userRow.password_hash);
  if (!ok) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  const { password_hash, ...user } = userRow;
  const token = 'TOKEN_PLACEHOLDER'; // Replace with JWT when implemented

  return { user, token };
}

module.exports = {
  registerUser,
  loginUser,
};
