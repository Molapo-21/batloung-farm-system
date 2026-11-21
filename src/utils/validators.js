'use strict';
const AppError = require('./AppError');

const SIZES = ['SMALL', 'MEDIUM', 'LARGE'];
const PROVINCES = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape',
  'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'];
const PAYMENT_METHODS = ['CASH', 'MOBILE_MONEY', 'CREDIT'];

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function requireText(body, field, label, max = 255) {
  if (isBlank(body[field])) throw new AppError(`${label} is required`, 400);
  const v = String(body[field]).trim();
  if (v.length > max) throw new AppError(`${label} must be at most ${max} characters`, 400);
  return v;
}

function requirePositiveInt(v, label) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(`${label} must be a positive whole number`, 400);
  return n;
}

function requireId(v, label = 'ID') {
  return requirePositiveInt(v, label);
}

function requireSize(v, label = 'packaging_size') {
  const s = String(v || '').trim().toUpperCase();
  if (!SIZES.includes(s)) throw new AppError(`${label} must be one of ${SIZES.join(', ')}`, 400);
  return s;
}

function requireNonNegativeNumber(v, label) {
  if (isBlank(v) || Number.isNaN(Number(v)) || Number(v) < 0)
    throw new AppError(`${label} must be a number greater than or equal to 0`, 400);
  return money(v);
}

function optionalDate(v, label) {
  if (isBlank(v)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(v)))
    throw new AppError(`${label} must be a valid date in YYYY-MM-DD format`, 400);
  return String(v);
}

function requirePhone(v, label = 'Phone') {
  if (isBlank(v)) throw new AppError(`${label} is required`, 400);
  const s = String(v).trim();
  if (!/^\+?[0-9 ()-]{7,20}$/.test(s)) throw new AppError(`${label} is not a valid phone number`, 400);
  return s;
}

module.exports = {
  SIZES, PROVINCES, PAYMENT_METHODS, isBlank, money, requireText, requirePositiveInt,
  requireId, requireSize, requireNonNegativeNumber, optionalDate, requirePhone
};
