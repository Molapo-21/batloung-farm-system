'use strict';
const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/AppError');

/**
 * Records a purchase from a supplier (many fruit lines) in ONE transaction:
 *   BEGIN -> validate supplier & fruits -> insert header + lines
 *         -> total calculated automatically -> stock increased -> COMMIT
 * Any failure => ROLLBACK, so no half-saved purchase and no stock change.
 */
exports.create = async ({ supplier_id, purchase_date, items }) => {
  const id = await withTransaction(async (conn) => {
    const [sup] = await conn.query('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [supplier_id]);
    if (!sup.length) throw new AppError(`Supplier ${supplier_id} does not exist`, 404);

    // Validate every item first (one bad item cancels the whole purchase)
    const problems = [];
    for (const [i, it] of items.entries()) {
      const [f] = await conn.query('SELECT fruit_name, status FROM fruits WHERE fruit_id = ?', [it.fruit_id]);
      if (!f.length) problems.push(`Item ${i + 1}: fruit ${it.fruit_id} does not exist`);
      else if (f[0].status !== 'ACTIVE') problems.push(`Item ${i + 1}: ${f[0].fruit_name} is INACTIVE and cannot be purchased`);
    }
    if (problems.length) throw new AppError('Purchase rejected - nothing was saved', 400, problems);

    // Total in whole cents to avoid floating-point errors
    const totalCents = items.reduce((s, it) => s + Math.round(it.unit_cost * 100) * it.quantity, 0);

    const [h] = await conn.query(
      'INSERT INTO purchases (supplier_id, purchase_date, total_amount) VALUES (?, COALESCE(?, CURRENT_DATE), ?)',
      [supplier_id, purchase_date, totalCents / 100]);

    for (const it of items) {
      await conn.query(
        `INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size)
         VALUES (?,?,?,?,?)`, [h.insertId, it.fruit_id, it.quantity, it.unit_cost, it.packaging_size]);
      // Increase stock for THIS fruit and THIS packaging size only
      await conn.query(
        `INSERT INTO stock (fruit_id, packaging_size, available_quantity, selling_price) VALUES (?,?,?,0)
         ON DUPLICATE KEY UPDATE available_quantity = available_quantity + VALUES(available_quantity)`,
        [it.fruit_id, it.packaging_size, it.quantity]);
    }
    return h.insertId;
  });
  return exports.findById(id);
};

exports.findAll = async () => {
  const [rows] = await pool.query(
    `SELECT p.purchase_id, p.supplier_id, s.business_name, s.province, p.purchase_date, p.total_amount,
            (SELECT COALESCE(SUM(quantity),0) FROM purchase_details d WHERE d.purchase_id = p.purchase_id) AS total_boxes
     FROM purchases p JOIN suppliers s ON s.supplier_id = p.supplier_id
     ORDER BY p.purchase_date DESC, p.purchase_id DESC`);
  return rows;
};

exports.findById = async (id) => {
  const [h] = await pool.query(
    `SELECT p.purchase_id, p.supplier_id, s.business_name, s.province, p.purchase_date, p.total_amount
     FROM purchases p JOIN suppliers s ON s.supplier_id = p.supplier_id WHERE p.purchase_id = ?`, [id]);
  if (!h.length) return null;
  const [items] = await pool.query(
    `SELECT d.purchase_detail_id, d.fruit_id, f.fruit_name, d.packaging_size, d.quantity, d.unit_cost,
            d.quantity * d.unit_cost AS line_total
     FROM purchase_details d JOIN fruits f ON f.fruit_id = d.fruit_id
     WHERE d.purchase_id = ? ORDER BY d.purchase_detail_id`, [id]);
  return { ...h[0], items };
};
