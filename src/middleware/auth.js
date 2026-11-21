'use strict';
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)
    throw new AppError('Server is not configured for login (JWT_SECRET missing or too short)', 500);
  return process.env.JWT_SECRET;
}

exports.signToken = (admin) =>
  jwt.sign({ sub: admin.admin_id, username: admin.username, name: admin.full_name }, secret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

/** Protects a route: requires  Authorization: Bearer <token> */
exports.requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new AppError('Authentication required. Please log in.', 401);
    try {
      const p = jwt.verify(token, secret());
      req.admin = { id: p.sub, username: p.username, name: p.name };
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(e.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token. Please log in again.', 401);
    }
    next();
  } catch (err) { next(err); }
};
