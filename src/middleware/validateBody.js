'use strict';
const AppError = require('../utils/AppError');

// Ensures POST/PUT bodies are JSON objects.
module.exports = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next(new AppError('Request body must be a JSON object', 400));
    }
  }
  next();
};
