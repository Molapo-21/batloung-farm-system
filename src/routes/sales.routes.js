'use strict';
const router = require('express').Router();
const c = require('../controllers/sales.controller');
const h = require('../middleware/asyncHandler');
const id = require('../middleware/validateId');
const body = require('../middleware/validateBody');

router.post('/', body, h(c.create));
router.get('/', h(c.list));
router.get('/:id', id('id'), h(c.get));
router.post('/:id/payments', id('id'), body, h(c.addPayment));
module.exports = router;
