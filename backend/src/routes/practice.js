const express = require('express');
const router = express.Router();
const { startPractice } = require('../controllers/practiceController');
const { auth } = require('../middleware/auth');
const { requireAccess } = require('../services/subscriptionService');

router.post('/start', auth, requireAccess, startPractice);

module.exports = router;
