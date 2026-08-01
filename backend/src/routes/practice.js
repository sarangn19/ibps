const express = require('express');
const router = express.Router();
const { startPractice } = require('../controllers/practiceController');
const { auth } = require('../middleware/auth');

router.post('/start', auth, startPractice);

module.exports = router;
