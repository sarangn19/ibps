const express = require('express');
const router = express.Router();
const { getMyMap, getHistory, getRecommendations } = require('../controllers/masteryController');
const { auth } = require('../middleware/auth');

router.get('/my-map', auth, getMyMap);
router.get('/history', auth, getHistory);
router.get('/recommendations', auth, getRecommendations);

module.exports = router;
