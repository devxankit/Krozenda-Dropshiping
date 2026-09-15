const express = require('express');
const { protectAdmin, requireRole } = require('../Middlewares/authMiddleware');
const { getBackups, triggerBackup, downloadBackup } = require('../Controllers/adminBackupController');

const router = express.Router();

router.use(protectAdmin, requireRole('admin'));

router.get('/', getBackups);
router.post('/run', triggerBackup);
router.get('/:id/download', downloadBackup);

module.exports = router;
