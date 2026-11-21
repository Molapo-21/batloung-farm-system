'use strict';
const AppError = require('../utils/AppError');

// Validates :id style route params.
module.exports = (...names) => (req, res, next) => {
  for (const n of names.length ? names : ['id']) {
    const v = Number(req.params[n]);
    if (!Number.isInteger(v) || v <= 0) return next(new AppError(`Invalid ${n}: must be a positive integer`, 400));
  }
  next();
};
