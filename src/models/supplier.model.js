'use strict';
const { pool } = require('../config/db');

const COLS = `supplier_id, business_name, contact_person, phone, province, address, created_at`;

exports.create = async ({ business_name, contact_person, phone, province, address }) => {
  const [r] = await pool.query(
    'INSERT INTO suppliers (business_name, contact_person, phone, province, address) VALUES (?,?,?,?,?)',
    [business_name, contact_person, phone, province, address]);
  return exports.findById(r.insertId);
};

exports.findAll = async () => {
  const [rows] = await pool.query(`SELECT ${COLS} FROM suppliers ORDER BY business_name`);
  return rows;
};

exports.findById = async (id) => {
  const [rows] = await pool.query(`SELECT ${COLS} FROM suppliers WHERE supplier_id = ?`, [id]);
  return rows[0] || null;
};

exports.update = async (id, d) => {
  const [r] = await pool.query(
    `UPDATE suppliers SET business_name=?, contact_person=?, phone=?, province=?, address=? WHERE supplier_id=?`,
    [d.business_name, d.contact_person, d.phone, d.province, d.address, id]);
  return r.affectedRows > 0;
};

exports.countPurchases = async (id) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM purchases WHERE supplier_id = ?', [id]);
  return rows[0].n;
};

exports.remove = async (id) => {
  const [r] = await pool.query('DELETE FROM suppliers WHERE supplier_id = ?', [id]);
  return r.affectedRows > 0;
};
