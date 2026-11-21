
'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // TiDB Cloud Serverless TLS configuration
  ssl: process.env.DB_SSL === 'true'
    ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized:
          process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      }
    : undefined,

  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 2,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true,
  connectTimeout: 10000
});

pool.on?.('error', (err) => {
  console.error('[db] pool error:', err.code || err.message);
});

async function testConnection() {
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.ping();

    return { ok: true };

  } catch (err) {
    console.error('[db] connection failed:', err.code, err.message);

    return {
      ok: false,
      error: err.code || err.message
    };

  } finally {
    if (conn) conn.release();
  }
}

module.exports = { pool, testConnection };
