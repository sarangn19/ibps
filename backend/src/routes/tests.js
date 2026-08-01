const express = require('express');
const router = express.Router();
const { getTests, getTestById, createTest } = require('../controllers/testController');
const { auth } = require('../middleware/auth');

router.get('/', auth, getTests);
router.get('/:id', auth, getTestById);
router.post('/', auth, createTest);

module.exports = router;
