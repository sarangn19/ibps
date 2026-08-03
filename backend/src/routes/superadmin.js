const express = require('express');
const router = express.Router();
const { getAdmins, addAdmin, deleteAdmin } = require('../controllers/superadminController');
const { auth, superadminOnly } = require('../middleware/auth');

router.get('/admins', auth, superadminOnly, getAdmins);
router.post('/admins', auth, superadminOnly, addAdmin);
router.delete('/admins/:id', auth, superadminOnly, deleteAdmin);

module.exports = router;
