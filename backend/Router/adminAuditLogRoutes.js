const express = require('express');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');
const { listAuditLogs } = require('../Controllers/adminAuditLogController');

const router = express.Router();

// Read-only on purpose: the log is append-only, so there is no write route.
router.use(protectAdmin, requirePermission('admin.audit.view'));

router.get('/', listAuditLogs);

module.exports = router;
