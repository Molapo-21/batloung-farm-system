'use strict';
const router = require('express').Router();
const c = require('../controllers/report.controller');
const h = require('../middleware/asyncHandler');

router.get('/summary', h(c.summary));
router.get('/top-fruits', h(c.topFruits));
router.get('/revenue', h(c.revenue));
router.get('/top-vendor', h(c.topVendor));
router.get('/stock-levels', h(c.stockLevels));
router.get('/outstanding-balances', h(c.outstanding));
module.exports = router;
