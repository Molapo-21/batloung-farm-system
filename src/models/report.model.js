'use strict';
const { pool } = require('../config/db');

// 1. Five most frequently sold fruits
exports.topFruits = async (limit = 5) => {
  const [rows] = await pool.query(
    `SELECT f.fruit_id, f.fruit_name, SUM(sd.quantity) AS boxes_sold, COUNT(DISTINCT sd.sale_id) AS number_of_sales
     FROM sales_details sd JOIN fruits f ON f.fruit_id = sd.fruit_id
     GROUP BY f.fruit_id, f.fruit_name ORDER BY boxes_sold DESC, f.fruit_name LIMIT ?`, [limit]);
  return rows;
};

// 2. Total sales revenue in a date range (inclusive)
exports.revenue = async (from, to) => {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(total_amount),0) AS total_revenue, COUNT(*) AS number_of_sales
     FROM sales WHERE sale_date BETWEEN ? AND ?`, [from, to]);
  return rows[0];
};

// 3. Vendor who has purchased the highest number of boxes
exports.topVendor = async () => {
  const [rows] = await pool.query(
    `SELECT v.vendor_id, v.vendor_name, v.phone_number, SUM(sd.quantity) AS total_boxes
     FROM vendors v JOIN sales s ON s.vendor_id = v.vendor_id JOIN sales_details sd ON sd.sale_id = s.sale_id
     GROUP BY v.vendor_id, v.vendor_name, v.phone_number ORDER BY total_boxes DESC LIMIT 1`);
  return rows[0] || null;
};

// 4. Current stock level for each fruit and packaging size
exports.stockLevels = async () => {
  const [rows] = await pool.query(
    `SELECT f.fruit_id, f.fruit_name, st.packaging_size, st.available_quantity, st.selling_price
     FROM stock st JOIN fruits f ON f.fruit_id = st.fruit_id
     ORDER BY f.fruit_name, FIELD(st.packaging_size,'SMALL','MEDIUM','LARGE')`);
  return rows;
};

// Vendors with outstanding payments
exports.outstandingBalances = async () => {
  const [rows] = await pool.query(
    `SELECT v.vendor_id, v.vendor_name, v.phone_number,
            SUM(s.total_amount) AS total_billed, SUM(COALESCE(p.paid,0)) AS total_paid,
            SUM(s.total_amount) - SUM(COALESCE(p.paid,0)) AS outstanding_balance,
            SUM(s.payment_status <> 'PAID') AS unpaid_sales
     FROM vendors v JOIN sales s ON s.vendor_id = v.vendor_id
     LEFT JOIN (SELECT sale_id, SUM(amount) AS paid FROM payments GROUP BY sale_id) p ON p.sale_id = s.sale_id
     GROUP BY v.vendor_id, v.vendor_name, v.phone_number
     HAVING outstanding_balance > 0 ORDER BY outstanding_balance DESC`);
  return rows;
};

// Dashboard numbers
exports.summary = async () => {
  const [[a]] = await pool.query(`SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS sales_count FROM sales`);
  const [[b]] = await pool.query(`SELECT COALESCE(SUM(total_amount),0) AS spent FROM purchases`);
  const [[c]] = await pool.query(`SELECT COALESCE(SUM(available_quantity),0) AS boxes_in_stock FROM stock`);
  const [[d]] = await pool.query(`SELECT COALESCE(SUM(s.total_amount - COALESCE(p.paid,0)),0) AS outstanding
     FROM sales s LEFT JOIN (SELECT sale_id, SUM(amount) paid FROM payments GROUP BY sale_id) p ON p.sale_id = s.sale_id`);
  const [[e]] = await pool.query(`SELECT COUNT(*) AS vendors FROM vendors`);
  const [[f]] = await pool.query(`SELECT COUNT(*) AS suppliers FROM suppliers`);
  return { revenue: a.revenue, sales_count: a.sales_count, purchases_total: b.spent,
           boxes_in_stock: c.boxes_in_stock, outstanding_payments: d.outstanding, vendors: e.vendors, suppliers: f.suppliers };
};
