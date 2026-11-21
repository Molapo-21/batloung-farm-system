'use strict';
const Purchase = require('../models/purchase.model');
const AppError = require('../utils/AppError');
const v = require('../utils/validators');

exports.create = async (req, res) => {
  const b = req.body;
  const supplier_id = v.requireId(b.supplier_id, 'supplier_id');
  if (!Array.isArray(b.items) || b.items.length === 0) throw new AppError('items must be a non-empty array of fruit lines', 400);
  if (b.items.length > 100) throw new AppError('A purchase can contain at most 100 items', 400);
  const items = b.items.map((it, i) => {
    if (!it || typeof it !== 'object') throw new AppError(`Item ${i + 1} is invalid`, 400);
    try {
      return {
        fruit_id: v.requireId(it.fruit_id, 'fruit_id'),
        packaging_size: v.requireSize(it.packaging_size),
        quantity: v.requirePositiveInt(it.quantity, 'quantity'),
        unit_cost: v.requireNonNegativeNumber(it.unit_cost, 'unit_cost')
      };
    } catch (e) { throw new AppError(`Item ${i + 1}: ${e.message}`, 400); }
  });
  const purchase = await Purchase.create({ supplier_id, purchase_date: v.optionalDate(b.purchase_date, 'purchase_date'), items });
  res.status(201).json({ success: true, message: 'Purchase recorded and stock updated', data: purchase });
};
exports.list = async (req, res) => {
  const data = await Purchase.findAll();
  res.status(200).json({ success: true, count: data.length, data });
};
exports.get = async (req, res) => {
  const p = await Purchase.findById(req.params.id);
  if (!p) throw new AppError(`Purchase ${req.params.id} not found`, 404);
  res.status(200).json({ success: true, data: p });
};
