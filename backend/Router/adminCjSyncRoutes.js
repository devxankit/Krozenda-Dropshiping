const express = require('express');
const { listSyncLogs, getJobStatus, runSyncNow } = require('../Controllers/adminCjSyncController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.cj.sync'));

router.get('/', listSyncLogs);
router.get('/job-status', getJobStatus);
router.post('/run-now', runSyncNow);

module.exports = router;
