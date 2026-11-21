'use strict';
const Stock = require('../models/stock.model');
const AppError = require('../utils/AppError');
const v = require('../utils/validators');

exports.list = async (req, res) => {
  const size = req.query.size ? v.requireSize(req.query.size, 'size') : undefined;
  const fruitId = req.query.fruit_id ? v.requireId(req.query.fruit_id, 'fruit_id') : undefined;
  const data = await Stock.findAll({ fruitId, size });
  res.status(200).json({ success: true, count: data.length, data });
};

exports.low = async (req, res) => {
  const raw = req.query.threshold ?? process.env.LOW_STOCK_THRESHOLD ?? 10;
  const threshold = Number(raw);
  if (!Number.isInteger(threshold) || threshold < 0) throw new AppError('threshold must be a whole number >= 0', 400);
  const data = await Stock.findLow(threshold);
  res.status(200).json({ success: true, threshold, count: data.length, data });
};
