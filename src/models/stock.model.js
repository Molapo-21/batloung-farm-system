'use strict';
const { pool } = require('../config/db');

const ORDER = `ORDER BY f.fruit_name, FIELD(st.packaging_size,'SMALL','MEDIUM','LARGE')`;

/** Current stock for every fruit and packaging size (optionally filtered). */
exports.findAll = async ({ fruitId, size } = {}) => {
  const where = []; const params = [];
  if (fruitId) { where.push('st.fruit_id = ?'); params.push(fruitId); }
  if (size)    { where.push('st.packaging_size = ?'); params.push(size); }
  const [rows] = await pool.query(
    `SELECT st.stock_id, st.fruit_id, f.fruit_name, f.status, st.packaging_size,
            st.available_quantity, st.selling_price
     FROM stock st JOIN fruits f ON f.fruit_id = st.fruit_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ${ORDER}`, params);
  return rows;
};

/** Stock rows whose available quantity is at or below the threshold. */
exports.findLow = async (threshold) => {
  const [rows] = await pool.query(
    `SELECT st.stock_id, st.fruit_id, f.fruit_name, st.packaging_size, st.available_quantity,
            ? AS threshold
     FROM stock st JOIN fruits f ON f.fruit_id = st.fruit_id
     WHERE f.status = 'ACTIVE' AND st.available_quantity <= ?
     ORDER BY st.available_quantity, f.fruit_name`, [threshold, threshold]);
  return rows;
};
