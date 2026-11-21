'use strict';
const router = require('express').Router();
const c = require('../controllers/auth.controller');
const h = require('../middleware/asyncHandler');
const body = require('../middleware/validateBody');
const { requireAuth } = require('../middleware/auth');
const { guard } = require('../middleware/loginLimiter');

router.post('/login', body, guard, h(c.login));            // public
router.get('/me', requireAuth, h(c.me));
router.post('/change-password', requireAuth, body, h(c.changePassword));
module.exports = router;
