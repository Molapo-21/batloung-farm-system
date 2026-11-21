'use strict';
// Database configuration - all credentials come from environment variables.
require('dotenv').config();
const mysql = require('mysql2/promise');

const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 3,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true,
  connectTimeout: 10000
});

// Idle pooled connections may emit errors; never let them crash the process.
pool.on?.('error', (err) => console.error('[db] pool error:', err.code || err.message));

/** Checks the connection. Never throws - returns { ok, error }. */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code || err.message };
  }
}

module.exports = { pool, testConnection };
