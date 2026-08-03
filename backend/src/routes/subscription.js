const express = require('express');
const router = express.Router();
const { getMySubscription, subscribe } = require('../controllers/subscriptionController');
const { auth } = require('../middleware/auth');

router.get('/me', auth, getMySubscription);
router.post('/subscribe', auth, subscribe);

module.exports = router;
