'use strict';
const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/AppError');

/** PAID / PARTIALLY_PAID / UNPAID from the total and what has been paid. */
function statusFor(totalCents, paidCents) {
  if (paidCents >= totalCents && totalCents > 0) return 'PAID';
  if (paidCents > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
}
exports.statusFor = statusFor;

/**
 * Records a sale with many items in ONE all-or-nothing transaction.
 *   BEGIN
 *     lock the stock rows (SELECT ... FOR UPDATE)
 *     if ANY item is short  -> ROLLBACK, reject the WHOLE sale (stock untouched)
 *     insert sale + lines (price taken from the per-size price list)
 *     total calculated automatically, stock reduced, first payment recorded
 *   COMMIT
 */
exports.create = async ({ vendor_id, sale_date, items, payment }) => {
  const saleId = await withTransaction(async (conn) => {
    const [v] = await conn.query('SELECT vendor_id FROM vendors WHERE vendor_id = ?', [vendor_id]);
    if (!v.length) throw new AppError(`Vendor ${vendor_id} is not registered`, 404);

    // Merge duplicate lines (same fruit + size) and lock rows in a fixed order (avoids deadlocks)
    const merged = new Map();
    for (const it of items) {
      const k = `${it.fruit_id}|${it.packaging_size}`;
      merged.set(k, { ...it, quantity: (merged.get(k)?.quantity || 0) + it.quantity });
    }
    const lines = [...merged.values()].sort((a, b) => a.fruit_id - b.fruit_id || a.packaging_size.localeCompare(b.packaging_size));

    const problems = []; const priced = [];
    for (const it of lines) {
      const [rows] = await conn.query(
        `SELECT st.available_quantity, st.selling_price, f.fruit_name, f.status
         FROM stock st JOIN fruits f ON f.fruit_id = st.fruit_id
         WHERE st.fruit_id = ? AND st.packaging_size = ? FOR UPDATE`, [it.fruit_id, it.packaging_size]);
      if (!rows.length) { problems.push({ fruit_id: it.fruit_id, packaging_size: it.packaging_size, reason: 'Fruit or packaging size not found in stock' }); continue; }
      const s = rows[0];
      if (s.status !== 'ACTIVE') { problems.push({ fruit_id: it.fruit_id, fruit_name: s.fruit_name, packaging_size: it.packaging_size, reason: 'Fruit is INACTIVE' }); continue; }
      if (!(s.selling_price > 0)) { problems.push({ fruit_id: it.fruit_id, fruit_name: s.fruit_name, packaging_size: it.packaging_size, reason: 'No selling price set for this size' }); continue; }
      if (it.quantity > s.available_quantity) {
        problems.push({ fruit_id: it.fruit_id, fruit_name: s.fruit_name, packaging_size: it.packaging_size,
          requested: it.quantity, available: s.available_quantity,
          reason: `Insufficient stock: requested ${it.quantity} ${it.packaging_size.toLowerCase()} box(es) of ${s.fruit_name}, only ${s.available_quantity} available` });
        continue;
      }
      priced.push({ ...it, unit_price: s.selling_price });
    }
    if (problems.length) {
      // Thrown inside the transaction => ROLLBACK; the entire sale is rejected.
      throw new AppError('Sale rejected - stock unavailable. No stock was reduced and no sale was created.', 400, problems);
    }

    // Automatic total (whole cents)
    const totalCents = priced.reduce((s, it) => s + Math.round(it.unit_price * 100) * it.quantity, 0);

    // Payment validation
    const method = payment.method;
    let paidCents = method === 'CREDIT' ? 0 : Math.round(payment.amount * 100);
    if (method !== 'CREDIT' && paidCents <= 0) throw new AppError(`${method} payment needs an amount greater than 0 (use CREDIT for no payment now)`, 400);
    if (paidCents > totalCents) throw new AppError(`Payment (${payment.amount}) is more than the sale total (${totalCents / 100})`, 400);

    const [sale] = await conn.query(
      `INSERT INTO sales (vendor_id, sale_date, payment_status, total_amount) VALUES (?, COALESCE(?, CURRENT_DATE), ?, ?)`,
      [vendor_id, sale_date, statusFor(totalCents, paidCents), totalCents / 100]);

    for (const it of priced) {
      await conn.query(
        `INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES (?,?,?,?,?)`,
        [sale.insertId, it.fruit_id, it.packaging_size, it.quantity, it.unit_price]);
      // Guarded decrement: can never take stock below zero
      const [u] = await conn.query(
        `UPDATE stock SET available_quantity = available_quantity - ?
         WHERE fruit_id = ? AND packaging_size = ? AND available_quantity >= ?`,
        [it.quantity, it.fruit_id, it.packaging_size, it.quantity]);
      if (u.affectedRows !== 1) throw new AppError('Stock changed during the sale - please retry', 400);
    }

    await conn.query(
      `INSERT INTO payments (sale_id, payment_method, amount, reference) VALUES (?,?,?,?)`,
      [sale.insertId, method, paidCents / 100, payment.reference]);

    return sale.insertId;
  });
  return exports.findById(saleId);
};

const SALE_SELECT = `
  SELECT s.sale_id, s.vendor_id, v.vendor_name, v.phone_number, s.sale_date, s.payment_status, s.total_amount,
         COALESCE(p.paid,0) AS amount_paid, s.total_amount - COALESCE(p.paid,0) AS outstanding_balance,
         (SELECT COALESCE(SUM(quantity),0) FROM sales_details d WHERE d.sale_id = s.sale_id) AS total_boxes
  FROM sales s
  JOIN vendors v ON v.vendor_id = s.vendor_id
  LEFT JOIN (SELECT sale_id, SUM(amount) AS paid FROM payments GROUP BY sale_id) p ON p.sale_id = s.sale_id`;

exports.findAll = async ({ vendorId, status } = {}) => {
  const where = []; const params = [];
  if (vendorId) { where.push('s.vendor_id = ?'); params.push(vendorId); }
  if (status)   { where.push('s.payment_status = ?'); params.push(status); }
  const [rows] = await pool.query(
    `${SALE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.sale_date DESC, s.sale_id DESC`, params);
  return rows;
};

exports.findById = async (id) => {
  const [h] = await pool.query(`${SALE_SELECT} WHERE s.sale_id = ?`, [id]);
  if (!h.length) return null;
  const [items] = await pool.query(
    `SELECT d.sales_detail_id, d.fruit_id, f.fruit_name, d.packaging_size, d.quantity, d.unit_price,
            d.quantity * d.unit_price AS line_total
     FROM sales_details d JOIN fruits f ON f.fruit_id = d.fruit_id WHERE d.sale_id = ? ORDER BY d.sales_detail_id`, [id]);
  const [payments] = await pool.query(
    `SELECT payment_id, payment_method, amount, payment_date, reference FROM payments WHERE sale_id = ? ORDER BY payment_id`, [id]);
  return { ...h[0], items, payments };
};

/** Records a further payment (cash / mobile money) against an existing sale. */
exports.addPayment = async (saleId, { method, amount, reference }) => {
  await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT sale_id, total_amount FROM sales WHERE sale_id = ? FOR UPDATE', [saleId]);
    if (!rows.length) throw new AppError(`Sale ${saleId} does not exist`, 404);
    const [p] = await conn.query('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE sale_id = ?', [saleId]);
    const totalCents = Math.round(rows[0].total_amount * 100);
    const paidCents = Math.round(p[0].paid * 100);
    const outstanding = totalCents - paidCents;
    const amtCents = Math.round(amount * 100);
    if (outstanding <= 0) throw new AppError('This sale is already fully paid', 400);
    if (amtCents > outstanding) throw new AppError(`Payment exceeds the outstanding balance of ${(outstanding / 100).toFixed(2)}`, 400);
    await conn.query('INSERT INTO payments (sale_id, payment_method, amount, reference) VALUES (?,?,?,?)',
      [saleId, method, amtCents / 100, reference]);
    await conn.query('UPDATE sales SET payment_status = ? WHERE sale_id = ?', [statusFor(totalCents, paidCents + amtCents), saleId]);
  });
  return exports.findById(saleId);
};
