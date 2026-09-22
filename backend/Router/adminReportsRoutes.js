const express = require('express');
const { listReports, runReport } = require('../Controllers/adminReportsController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.reports.view'));

router.get('/', listReports);
router.get('/:reportKey', runReport);

module.exports = router;
