'use strict';
const Sales = require('../models/sales.model');
const AppError = require('../utils/AppError');
const v = require('../utils/validators');

function parsePayment(b) {
  const method = String(b.payment_method || 'CREDIT').toUpperCase();
  if (!v.PAYMENT_METHODS.includes(method)) throw new AppError(`payment_method must be one of ${v.PAYMENT_METHODS.join(', ')}`, 400);
  const amount = method === 'CREDIT' ? 0 : v.requireNonNegativeNumber(b.amount_paid, 'amount_paid');
  return { method, amount, reference: v.isBlank(b.reference) ? null : String(b.reference).trim().slice(0, 60) };
}

exports.create = async (req, res) => {
  const b = req.body;
  const vendor_id = v.requireId(b.vendor_id, 'vendor_id');
  if (!Array.isArray(b.items) || b.items.length === 0) throw new AppError('items must be a non-empty array of fruit lines', 400);
  if (b.items.length > 100) throw new AppError('A sale can contain at most 100 items', 400);
  const items = b.items.map((it, i) => {
    if (!it || typeof it !== 'object') throw new AppError(`Item ${i + 1} is invalid`, 400);
    try {
      return {
        fruit_id: v.requireId(it.fruit_id, 'fruit_id'),
        packaging_size: v.requireSize(it.packaging_size),
        quantity: v.requirePositiveInt(it.quantity, 'quantity')
      };
    } catch (e) { throw new AppError(`Item ${i + 1}: ${e.message}`, 400); }
  });
  // NOTE: the total is never read from the request - it is always calculated by the server.
  const sale = await Sales.create({ vendor_id, sale_date: v.optionalDate(b.sale_date, 'sale_date'), items, payment: parsePayment(b) });
  res.status(201).json({ success: true, message: 'Sale recorded, total calculated and stock reduced', data: sale });
};
exports.list = async (req, res) => {
  const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
  if (status && !['PAID', 'PARTIALLY_PAID', 'UNPAID'].includes(status)) throw new AppError('status must be PAID, PARTIALLY_PAID or UNPAID', 400);
  const vendorId = req.query.vendor_id ? v.requireId(req.query.vendor_id, 'vendor_id') : undefined;
  const data = await Sales.findAll({ vendorId, status });
  res.status(200).json({ success: true, count: data.length, data });
};
exports.get = async (req, res) => {
  const s = await Sales.findById(req.params.id);
  if (!s) throw new AppError(`Sale ${req.params.id} not found`, 404);
  res.status(200).json({ success: true, data: s });
};
exports.addPayment = async (req, res) => {
  const method = String(req.body.payment_method || '').toUpperCase();
  if (!['CASH', 'MOBILE_MONEY'].includes(method)) throw new AppError('payment_method must be CASH or MOBILE_MONEY (CREDIT is only chosen when the sale is created)', 400);
  const amount = v.requireNonNegativeNumber(req.body.amount, 'amount');
  if (amount <= 0) throw new AppError('amount must be greater than 0', 400);
  const sale = await Sales.addPayment(req.params.id, { method, amount, reference: v.isBlank(req.body.reference) ? null : String(req.body.reference).trim().slice(0, 60) });
  res.status(201).json({ success: true, message: 'Payment recorded', data: sale });
};
