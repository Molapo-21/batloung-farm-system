'use strict';
const Supplier = require('../models/supplier.model');
const AppError = require('../utils/AppError');
const v = require('../utils/validators');

function parse(body, existing = {}) {
  const b = { ...existing, ...body };
  const province = String(b.province || '').trim();
  const match = v.PROVINCES.find((p) => p.toLowerCase() === province.toLowerCase());
  if (!match) throw new AppError(`province must be one of: ${v.PROVINCES.join(', ')}`, 400);
  return {
    business_name: v.requireText(b, 'business_name', 'Business name', 120),
    contact_person: v.requireText(b, 'contact_person', 'Contact person', 100),
    phone: v.requirePhone(b.phone, 'Phone'),
    province: match,
    address: v.requireText(b, 'address', 'Address', 255)
  };
}

exports.create = async (req, res) => {
  const supplier = await Supplier.create(parse(req.body));
  res.status(201).json({ success: true, message: 'Supplier registered', data: supplier });
};
exports.list = async (req, res) => {
  const data = await Supplier.findAll();
  res.status(200).json({ success: true, count: data.length, data });
};
exports.get = async (req, res) => {
  const s = await Supplier.findById(req.params.id);
  if (!s) throw new AppError(`Supplier ${req.params.id} not found`, 404);
  res.status(200).json({ success: true, data: s });
};
exports.update = async (req, res) => {
  const existing = await Supplier.findById(req.params.id);
  if (!existing) throw new AppError(`Supplier ${req.params.id} not found`, 404);
  await Supplier.update(req.params.id, parse(req.body, existing));
  res.status(200).json({ success: true, message: 'Supplier updated', data: await Supplier.findById(req.params.id) });
};
exports.remove = async (req, res) => {
  const s = await Supplier.findById(req.params.id);
  if (!s) throw new AppError(`Supplier ${req.params.id} not found`, 404);
  // Business constraint: suppliers with purchase history must be kept for audit/records
  const n = await Supplier.countPurchases(req.params.id);
  if (n > 0) throw new AppError(`Cannot delete ${s.business_name}: it has ${n} recorded purchase(s). Suppliers with purchase history must be kept.`, 409);
  await Supplier.remove(req.params.id);
  res.status(200).json({ success: true, message: 'Supplier deleted' });
};
