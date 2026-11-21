'use strict';
const { pool } = require('../config/db');

exports.findByUsername = async (username) => {
  const [rows] = await pool.query(
    'SELECT admin_id, username, password_hash, full_name FROM admins WHERE username = ?', [username]);
  return rows[0] || null;
};

exports.findById = async (id) => {
  const [rows] = await pool.query(
    'SELECT admin_id, username, password_hash, full_name, last_login FROM admins WHERE admin_id = ?', [id]);
  return rows[0] || null;
};

exports.touchLogin = (id) => pool.query('UPDATE admins SET last_login = NOW() WHERE admin_id = ?', [id]);

exports.updatePassword = (id, hash) =>
  pool.query('UPDATE admins SET password_hash = ? WHERE admin_id = ?', [hash, id]);
