'use strict';
/**
 * Database connection pool using pg.
 * Reads env vars: POSTGRES_URL or individual POSTGRES_* parts.
 *
 * This module defensively ignores malformed POSTGRES_URL values that do not include
 * a username (e.g., "postgresql://localhost:5000/myapp"), which would otherwise
 * cause: "no PostgreSQL user name specified in startup packet".
 */
const { Pool } = require('pg');
const url = require('url');

/**
 * Validate that a postgres connection URL includes a username.
 * Returns the URL string if valid, otherwise null.
 */
function validatePostgresUrl(maybeUrl) {
  if (!maybeUrl || typeof maybeUrl !== 'string') return null;
  try {
    const parsed = new url.URL(maybeUrl);
    // Accept schemes: postgres or postgresql
    const schemeOk = ['postgres:', 'postgresql:'].includes(parsed.protocol);
    const hasUser = parsed.username && parsed.username.length > 0;
    return schemeOk && hasUser ? maybeUrl : null;
  } catch {
    return null;
  }
}

/**
 * Build a connection string using either a valid POSTGRES_URL or the individual parts.
 * If both are present but POSTGRES_URL is invalid (missing username), we prefer the parts.
 */
function buildConnectionString() {
  const parts = {
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || '5432',
    db: process.env.POSTGRES_DB,
  };

  const urlFromEnv = validatePostgresUrl(process.env.POSTGRES_URL);

  // If we have all parts for a full connection string, prefer them,
  // as some environments export a URL without credentials.
  if (parts.user && parts.password && parts.db) {
    return `postgresql://${encodeURIComponent(parts.user)}:${encodeURIComponent(parts.password)}@${parts.host}:${parts.port}/${parts.db}`;
  }

  // Otherwise, fall back to a valid POSTGRES_URL if provided
  if (urlFromEnv) {
    return urlFromEnv;
  }

  // As a final fallback, if only some parts exist but we don't have credentials,
  // return null so pg uses its defaults (often peer auth on localhost) or the caller
  // can handle the configuration error more gracefully.
  return null;
}

const connectionString = buildConnectionString();

const pool = new Pool(
  connectionString
    ? { connectionString, ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false }
    : undefined
);

// Add more helpful diagnostics on pool errors
pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err && err.message ? err.message : err);
  if (!connectionString) {
    console.error(
      'PostgreSQL connection not configured. Expected either a valid POSTGRES_URL (with username) or POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB variables.'
    );
  }
});

module.exports = pool;
