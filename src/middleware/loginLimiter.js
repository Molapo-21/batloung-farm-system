'use strict';
// Simple in-memory brute-force protection: 8 failed attempts per IP+username per 15 minutes.
const AppError = require('../utils/AppError');
const WINDOW = 15 * 60 * 1000, MAX = 8;
const hits = new Map();

const key = (req) => `${req.ip}|${String(req.body?.username || '').toLowerCase()}`;

exports.guard = (req, res, next) => {
  const h = hits.get(key(req));
  if (h && h.reset > Date.now() && h.count >= MAX)
    return next(new AppError('Too many failed login attempts. Try again in a few minutes.', 429));
  next();
};
exports.fail = (req) => {
  const k = key(req), now = Date.now(); const h = hits.get(k);
  if (!h || h.reset < now) hits.set(k, { count: 1, reset: now + WINDOW }); else h.count++;
};
exports.clear = (req) => hits.delete(key(req));
