const express = require('express');
const router = express.Router();
const { runFetch, runDailyFetch, listFeed, listQuiz, stats } = require('../controllers/caController');
const { auth, adminOnly } = require('../middleware/auth');
const { requireAccess } = require('../services/subscriptionService');

router.post('/fetch', auth, adminOnly, runFetch);
router.get('/fetch-daily', runDailyFetch);
router.get('/feed', auth, requireAccess, listFeed);
router.get('/quiz', auth, requireAccess, listQuiz);
router.get('/stats', auth, requireAccess, stats);

module.exports = router;
