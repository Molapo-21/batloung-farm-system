'use strict';
const router = require('express').Router();
const c = require('../controllers/fruit.controller');
const h = require('../middleware/asyncHandler');
const id = require('../middleware/validateId');
const body = require('../middleware/validateBody');

router.post('/', body, h(c.create));
router.get('/', h(c.list));
router.get('/:id/stock', id('id'), h(c.stock));
router.get('/:id', id('id'), h(c.get));
router.put('/:id/prices', id('id'), body, h(c.updatePrices));
router.put('/:id', id('id'), body, h(c.update));
module.exports = router;
