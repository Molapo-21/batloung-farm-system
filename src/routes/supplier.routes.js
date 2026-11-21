'use strict';
const router = require('express').Router();
const c = require('../controllers/supplier.controller');
const h = require('../middleware/asyncHandler');
const id = require('../middleware/validateId');
const body = require('../middleware/validateBody');

router.post('/', body, h(c.create));
router.get('/', h(c.list));
router.get('/:id', id('id'), h(c.get));
router.put('/:id', id('id'), body, h(c.update));
router.delete('/:id', id('id'), h(c.remove));
module.exports = router;
