'use strict';
const AppError = require('../utils/AppError');

// MySQL error codes that mean "the database is unreachable / unavailable"
const DB_DOWN = new Set(['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ENOTFOUND',
  'EHOSTUNREACH', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR',
  'ECONNRESET', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR']);

function notFound(req, res) {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Central error handler: turns any thrown error into a meaningful JSON response.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Request body contains invalid JSON' });
  }
  if (DB_DOWN.has(err.code)) {
    console.error('[db] unavailable:', err.code);
    return res.status(503).json({ success: false, error: 'The database is currently unavailable. Please try again shortly.' });
  }
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return res.status(409).json({ success: false, error: 'A record with the same unique value already exists' });
    case 'ER_NO_REFERENCED_ROW_2':
      return res.status(400).json({ success: false, error: 'A referenced record (supplier, vendor or fruit) does not exist' });
    case 'ER_ROW_IS_REFERENCED_2':
      return res.status(409).json({ success: false, error: 'Cannot delete: this record is referenced by other records' });
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
    case 'ER_DATA_OUT_OF_RANGE':
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_WARN_DATA_OUT_OF_RANGE':
      return res.status(400).json({ success: false, error: 'A value violates a database rule (e.g. negative stock or an invalid value)' });
    default:
  }
  console.error('[error]', err);
  res.status(500).json({ success: false, error: 'Unexpected server error. Please try again later.' });
}

module.exports = { notFound, errorHandler };
