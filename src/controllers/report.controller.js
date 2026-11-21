'use strict';
const Report = require('../models/report.model');
const AppError = require('../utils/AppError');
const v = require('../utils/validators');

exports.topFruits = async (req, res) => {
  res.status(200).json({ success: true, data: await Report.topFruits(5) });
};
exports.revenue = async (req, res) => {
  const from = v.optionalDate(req.query.from, 'from');
  const to = v.optionalDate(req.query.to, 'to');
  if (!from || !to) throw new AppError('Both ?from=YYYY-MM-DD and ?to=YYYY-MM-DD are required', 400);
  if (from > to) throw new AppError('from must not be later than to', 400);
  res.status(200).json({ success: true, from, to, data: await Report.revenue(from, to) });
};
exports.topVendor = async (req, res) => {
  const data = await Report.topVendor();
  res.status(200).json({ success: true, data, message: data ? undefined : 'No sales recorded yet' });
};
exports.stockLevels = async (req, res) => {
  res.status(200).json({ success: true, data: await Report.stockLevels() });
};
exports.outstanding = async (req, res) => {
  res.status(200).json({ success: true, data: await Report.outstandingBalances() });
};
exports.summary = async (req, res) => {
  res.status(200).json({ success: true, data: await Report.summary() });
};
