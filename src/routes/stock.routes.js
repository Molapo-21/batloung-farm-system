'use strict';
const router = require('express').Router();
const c = require('../controllers/stock.controller');
const h = require('../middleware/asyncHandler');

router.get('/low', h(c.low));
router.get('/', h(c.list));
module.exports = router;
