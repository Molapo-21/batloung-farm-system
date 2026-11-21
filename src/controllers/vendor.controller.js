'use strict';
const Vendor = require('../models/vendor.model');
const AppError = require('../utils/AppError');
const v = require('../utils/validators');

function parse(body, existing = {}) {
  const b = { ...existing, ...body };
  return {
    vendor_name: v.requireText(b, 'vendor_name', 'Vendor name', 100),
    phone_number: v.requirePhone(b.phone_number, 'Phone number'),
    location: v.requireText(b, 'location', 'Location', 150),
    registration_date: v.optionalDate(body.registration_date, 'registration_date')
  };
}

exports.create = async (req, res) => {
  const vendor = await Vendor.create(parse(req.body));
  res.status(201).json({ success: true, message: 'Vendor registered', data: vendor });
};
exports.list = async (req, res) => {
  const data = await Vendor.findAll();
  res.status(200).json({ success: true, count: data.length, data });
};
exports.search = async (req, res) => {
  const q = String(req.query.q ?? req.query.name ?? req.query.phone ?? '').trim();
  if (!q) throw new AppError('Provide a search term, e.g. /api/vendors/search?q=Mpho or ?q=5800', 400);
  const data = await Vendor.search(q);
  res.status(200).json({ success: true, query: q, count: data.length, data });
};
exports.get = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new AppError(`Vendor ${req.params.id} not found`, 404);
  res.status(200).json({ success: true, data: vendor });
};
exports.update = async (req, res) => {
  const existing = await Vendor.findById(req.params.id);
  if (!existing) throw new AppError(`Vendor ${req.params.id} not found`, 404);
  const d = parse(req.body, existing);
  await Vendor.update(req.params.id, d);
  res.status(200).json({ success: true, message: 'Vendor updated', data: await Vendor.findById(req.params.id) });
};
