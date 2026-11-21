'use strict';
const Fruit = require('../models/fruit.model');
const Stock = require('../models/stock.model');
const AppError = require('../utils/AppError');
const v = require('../utils/validators');

/** Reads prices from { prices: {small, medium, large} }; all three must differ. */
function parsePrices(raw, required) {
  if (raw === undefined || raw === null) {
    if (required) throw new AppError('prices {small, medium, large} are required', 400);
    return null;
  }
  const out = {};
  for (const size of v.SIZES) {
    const val = raw[size] ?? raw[size.toLowerCase()];
    if (v.isBlank(val)) throw new AppError(`prices.${size.toLowerCase()} is required (all three sizes need a price)`, 400);
    out[size] = v.requireNonNegativeNumber(val, `prices.${size.toLowerCase()}`);
    if (out[size] <= 0) throw new AppError(`prices.${size.toLowerCase()} must be greater than 0`, 400);
  }
  if (new Set(Object.values(out)).size !== 3)
    throw new AppError('Each packaging size must have a different selling price', 400);
  return out;
}

function parseFruit(body, existing = {}) {
  const b = { ...existing, ...body };
  const status = String(b.status || 'ACTIVE').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new AppError('status must be ACTIVE or INACTIVE', 400);
  return {
    fruit_name: v.requireText(b, 'fruit_name', 'Fruit name', 60),
    description: v.isBlank(b.description) ? null : String(b.description).trim().slice(0, 255),
    status
  };
}

exports.create = async (req, res) => {
  const prices = parsePrices(req.body.prices, false) || { SMALL: 0, MEDIUM: 0, LARGE: 0 };
  const fruit = await Fruit.create(parseFruit(req.body), prices);
  res.status(201).json({ success: true, message: 'Fruit registered with SMALL, MEDIUM and LARGE stock records', data: fruit });
};
exports.list = async (req, res) => {
  const data = await Fruit.findAll({ onlyActive: req.query.status === 'ACTIVE' || req.query.active === 'true' });
  res.status(200).json({ success: true, count: data.length, data });
};
exports.get = async (req, res) => {
  const f = await Fruit.findById(req.params.id);
  if (!f) throw new AppError(`Fruit ${req.params.id} not found`, 404);
  res.status(200).json({ success: true, data: { ...f, stock: await Stock.findAll({ fruitId: f.fruit_id }) } });
};
exports.update = async (req, res) => {
  const existing = await Fruit.findById(req.params.id);
  if (!existing) throw new AppError(`Fruit ${req.params.id} not found`, 404);
  await Fruit.update(req.params.id, parseFruit(req.body, existing));
  if (req.body.prices) await Fruit.updatePrices(req.params.id, parsePrices(req.body.prices, true));
  res.status(200).json({ success: true, message: 'Fruit updated', data: await Fruit.findById(req.params.id) });
};
exports.updatePrices = async (req, res) => {
  const existing = await Fruit.findById(req.params.id);
  if (!existing) throw new AppError(`Fruit ${req.params.id} not found`, 404);
  await Fruit.updatePrices(req.params.id, parsePrices(req.body.prices ?? req.body, true));
  res.status(200).json({ success: true, message: 'Prices updated', data: await Stock.findAll({ fruitId: req.params.id }) });
};
exports.stock = async (req, res) => {
  const f = await Fruit.findById(req.params.id);
  if (!f) throw new AppError(`Fruit ${req.params.id} not found`, 404);
  res.status(200).json({ success: true, fruit: f.fruit_name, data: await Stock.findAll({ fruitId: f.fruit_id }) });
};
