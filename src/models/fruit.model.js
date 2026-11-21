'use strict';
const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { SIZES } = require('../utils/validators');

exports.findAll = async ({ onlyActive = false } = {}) => {
  const [rows] = await pool.query(
    `SELECT fruit_id, fruit_name, description, status FROM fruits
     ${onlyActive ? "WHERE status = 'ACTIVE'" : ''} ORDER BY fruit_name`);
  return rows;
};

exports.findById = async (id) => {
  const [rows] = await pool.query(
    'SELECT fruit_id, fruit_name, description, status FROM fruits WHERE fruit_id = ?', [id]);
  return rows[0] || null;
};

/** Creates the fruit AND its three stock rows (SMALL/MEDIUM/LARGE) atomically. */
exports.create = async ({ fruit_name, description, status }, prices) => {
  const id = await withTransaction(async (conn) => {
    const [r] = await conn.query(
      'INSERT INTO fruits (fruit_name, description, status) VALUES (?,?,?)',
      [fruit_name, description, status]);
    for (const size of SIZES) {
      await conn.query(
        'INSERT INTO stock (fruit_id, packaging_size, available_quantity, selling_price) VALUES (?,?,0,?)',
        [r.insertId, size, prices[size]]);
    }
    return r.insertId;
  });
  return exports.findById(id);
};

exports.update = async (id, { fruit_name, description, status }) => {
  const [r] = await pool.query(
    'UPDATE fruits SET fruit_name=?, description=?, status=? WHERE fruit_id=?',
    [fruit_name, description, status, id]);
  return r.affectedRows > 0;
};

/** Sets the per-size selling prices (each size keeps its own price). */
exports.updatePrices = async (id, prices) => {
  await withTransaction(async (conn) => {
    for (const size of SIZES) {
      if (prices[size] === undefined) continue;
      await conn.query(
        `INSERT INTO stock (fruit_id, packaging_size, available_quantity, selling_price) VALUES (?,?,0,?)
         ON DUPLICATE KEY UPDATE selling_price = VALUES(selling_price)`,
        [id, size, prices[size]]);
    }
  });
};
