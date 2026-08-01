const express = require('express');
const router = express.Router();
const { getQuestions, getQuestionById, createQuestion } = require('../controllers/questionController');
const { auth } = require('../middleware/auth');

router.get('/', auth, getQuestions);
router.get('/:id', auth, getQuestionById);
router.post('/', auth, createQuestion);

module.exports = router;
