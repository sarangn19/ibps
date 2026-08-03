const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getStudents, getStudentDetail, getCohort, getFlags, getBatches } = require('../controllers/adminController');
const { getResearchDashboard } = require('../controllers/researchController');
const { uploadQuestions, downloadTemplate } = require('../controllers/questionUploadController');
const { getQuestions, getAdminQuestions, getQuestionStats, getQuestionById, updateQuestion, deleteQuestion, getSubjects } = require('../controllers/questionController');
const { generateTest } = require('../controllers/adminTestController');
const { listSubscriptions, grantSubscription, revokeSubscription } = require('../controllers/subscriptionController');
const { auth, adminOnly } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 128 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(xlsx|xls|csv)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Only .xlsx, .xls, or .csv files are allowed'));
  }
});

router.get('/students', auth, adminOnly, getStudents);
router.get('/students/:id', auth, adminOnly, getStudentDetail);
router.get('/cohort', auth, adminOnly, getCohort);
router.get('/flags', auth, adminOnly, getFlags);
router.get('/batches', auth, adminOnly, getBatches);

router.get('/questions/template', auth, adminOnly, downloadTemplate);
router.post('/questions/upload', auth, adminOnly, upload.single('file'), uploadQuestions);

router.get('/questions/stats', auth, adminOnly, getQuestionStats);
router.post('/tests/generate', auth, adminOnly, generateTest);
router.get('/subscriptions', auth, adminOnly, listSubscriptions);
router.post('/subscriptions/grant', auth, adminOnly, grantSubscription);
router.post('/subscriptions/revoke', auth, adminOnly, revokeSubscription);
router.get('/questions', auth, adminOnly, getAdminQuestions);
router.get('/questions/subjects/tree', auth, adminOnly, getSubjects);
router.get('/questions/:id', auth, adminOnly, getQuestionById);
router.put('/questions/:id', auth, adminOnly, updateQuestion);
router.delete('/questions/:id', auth, adminOnly, deleteQuestion);
router.get('/research/dashboard', auth, adminOnly, getResearchDashboard);

module.exports = router;
