'use strict';
const { pool } = require('../config/db');

// Outstanding balance = total billed - total paid, calculated in SQL.
const WITH_BALANCE = `
  SELECT v.vendor_id, v.vendor_name, v.phone_number, v.location, v.registration_date,
         COALESCE(b.total_billed,0) AS total_billed,
         COALESCE(b.total_paid,0)   AS total_paid,
         COALESCE(b.total_billed,0) - COALESCE(b.total_paid,0) AS outstanding_balance
  FROM vendors v
  LEFT JOIN (
    SELECT s.vendor_id, SUM(s.total_amount) AS total_billed, SUM(COALESCE(p.paid,0)) AS total_paid
    FROM sales s
    LEFT JOIN (SELECT sale_id, SUM(amount) AS paid FROM payments GROUP BY sale_id) p ON p.sale_id = s.sale_id
    GROUP BY s.vendor_id
  ) b ON b.vendor_id = v.vendor_id`;

exports.create = async ({ vendor_name, phone_number, location, registration_date }) => {
  const [r] = await pool.query(
    'INSERT INTO vendors (vendor_name, phone_number, location, registration_date) VALUES (?,?,?,COALESCE(?, CURRENT_DATE))',
    [vendor_name, phone_number, location, registration_date]);
  return exports.findById(r.insertId);
};

exports.findAll = async () => {
  const [rows] = await pool.query(`${WITH_BALANCE} ORDER BY v.vendor_name`);
  return rows;
};

exports.findById = async (id) => {
  const [rows] = await pool.query(`${WITH_BALANCE} WHERE v.vendor_id = ?`, [id]);
  return rows[0] || null;
};

exports.search = async (term) => {
  const like = `%${term}%`;
  const [rows] = await pool.query(
    `${WITH_BALANCE} WHERE v.vendor_name LIKE ? OR v.phone_number LIKE ? ORDER BY v.vendor_name`, [like, like]);
  return rows;
};

exports.update = async (id, d) => {
  const [r] = await pool.query(
    'UPDATE vendors SET vendor_name=?, phone_number=?, location=? WHERE vendor_id=?',
    [d.vendor_name, d.phone_number, d.location, id]);
  return r.affectedRows > 0;
};
