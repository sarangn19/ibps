const express = require('express');
const router = express.Router();
const { startPractice, getEasyGA, retryMistakes } = require('../controllers/practiceController');
const { auth } = require('../middleware/auth');
const { requireAccess } = require('../services/subscriptionService');

router.post('/start', auth, requireAccess, startPractice);
router.get('/easy-ga', auth, requireAccess, getEasyGA);
router.post('/retry-mistakes', auth, requireAccess, retryMistakes);

module.exports = router;
