const express = require('express');
const router = express.Router();
const { startAttempt, saveResponse, submitAttempt, getAttemptResults, updateErrorTag } = require('../controllers/attemptController');
const { auth } = require('../middleware/auth');

router.post('/start', auth, startAttempt);
router.post('/response', auth, saveResponse);
router.post('/submit', auth, submitAttempt);
router.get('/:attempt_id/results', auth, getAttemptResults);
router.put('/error-tag', auth, updateErrorTag);

module.exports = router;
