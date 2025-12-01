'use strict';
/**
 * Database connection pool using pg.
 * Reads env vars: POSTGRES_URL or individual POSTGRES_* parts.
 */
const { Pool } = require('pg');

function buildConnectionString() {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB;
  if (!user || !password || !db) return null;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
}

const connectionString = buildConnectionString();
const pool = new Pool(connectionString ? { connectionString, ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false } : undefined);

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = pool;
