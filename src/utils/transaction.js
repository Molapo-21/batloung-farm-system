'use strict';
const { pool } = require('../config/db');

/**
 * Runs `work(conn)` inside a MySQL transaction.
 *   BEGIN -> work -> COMMIT      (success)
 *   BEGIN -> work throws -> ROLLBACK -> error re-thrown (nothing is saved)
 * The connection is ALWAYS released back to the pool.
 */
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.query('BEGIN');
    const result = await work(conn);
    await conn.query('COMMIT');
    return result;
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (rollbackErr) {
      console.error('[db] rollback failed:', rollbackErr.code || rollbackErr.message);
    }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { withTransaction };
