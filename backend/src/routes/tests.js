const express = require('express');
const router = express.Router();
const { getTests, getTestById, createTest } = require('../controllers/testController');
const { auth } = require('../middleware/auth');
const { requireAccess } = require('../services/subscriptionService');

router.get('/', auth, getTests);
router.get('/:id', auth, requireAccess, getTestById);
router.post('/', auth, requireAccess, createTest);

module.exports = router;
