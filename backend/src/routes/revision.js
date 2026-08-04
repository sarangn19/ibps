const express = require('express');
const router = express.Router();
const { getDaily, checkIn, getPreTest } = require('../controllers/revisionController');
const { getEasyGA } = require('../controllers/practiceController');
const { auth } = require('../middleware/auth');
const { requireAccess } = require('../services/subscriptionService');

router.get('/daily', auth, requireAccess, getDaily);
router.post('/checkin', auth, requireAccess, checkIn);
router.get('/pre-test/:testId', auth, requireAccess, getPreTest);
router.get('/easy-ga', auth, requireAccess, getEasyGA);

module.exports = router;
