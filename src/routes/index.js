'use strict';
const router = require('express').Router();
const { testConnection } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---- PUBLIC ----
router.get('/health', async (req, res) => {
  const db = await testConnection();
  res.status(db.ok ? 200 : 503).json({ success: db.ok, server: 'up', database: db.ok ? 'connected' : `unavailable (${db.error})` });
});
router.use('/auth', require('./auth.routes'));

// ---- PROTECTED: everything below needs a valid administrator token ----
router.use(requireAuth);
router.use('/suppliers', require('./supplier.routes'));
router.use('/fruits', require('./fruit.routes'));
router.use('/stock', require('./stock.routes'));
router.use('/vendors', require('./vendor.routes'));
router.use('/purchases', require('./purchase.routes'));
router.use('/sales', require('./sales.routes'));
router.use('/reports', require('./report.routes'));
module.exports = router;
