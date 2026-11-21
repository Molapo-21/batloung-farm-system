'use strict';
const bcrypt = require('bcryptjs');
const Admin = require('../models/admin.model');
const { signToken } = require('../middleware/auth');
const limiter = require('../middleware/loginLimiter');
const AppError = require('../utils/AppError');

// Used so that unknown usernames take as long to reject as wrong passwords (timing safety)
const DUMMY = bcrypt.hashSync('not-a-real-password', 10);

exports.login = async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) throw new AppError('Username and password are required', 400);

  const admin = await Admin.findByUsername(username);
  const ok = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY);
  if (!admin || !ok) { limiter.fail(req); throw new AppError('Invalid username or password', 401); }

  limiter.clear(req);
  await Admin.touchLogin(admin.admin_id);
  res.status(200).json({
    success: true, message: 'Logged in', token: signToken(admin),
    admin: { id: admin.admin_id, username: admin.username, name: admin.full_name }
  });
};

exports.me = async (req, res) => {
  const a = await Admin.findById(req.admin.id);
  if (!a) throw new AppError('Account no longer exists', 401);
  res.status(200).json({ success: true, admin: { id: a.admin_id, username: a.username, name: a.full_name, last_login: a.last_login } });
};

exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) throw new AppError('current_password and new_password are required', 400);
  if (String(new_password).length < 8) throw new AppError('New password must be at least 8 characters', 400);
  const a = await Admin.findById(req.admin.id);
  if (!a || !(await bcrypt.compare(String(current_password), a.password_hash))) throw new AppError('Current password is incorrect', 400);
  await Admin.updatePassword(a.admin_id, await bcrypt.hash(String(new_password), 10));
  res.status(200).json({ success: true, message: 'Password changed' });
};
