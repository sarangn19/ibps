const express = require('express');
const router = express.Router();
const { startAttempt, saveResponse, submitAttempt, getAttemptResults, updateErrorTag } = require('../controllers/attemptController');
const { auth } = require('../middleware/auth');
const { requireAccess } = require('../services/subscriptionService');

router.post('/start', auth, requireAccess, startAttempt);
router.post('/response', auth, requireAccess, saveResponse);
router.post('/submit', auth, requireAccess, submitAttempt);
router.get('/:attempt_id/results', auth, getAttemptResults);
router.put('/error-tag', auth, requireAccess, updateErrorTag);

module.exports = router;
