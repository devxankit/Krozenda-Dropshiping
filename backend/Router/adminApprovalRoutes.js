const express = require('express');
const {
  listApprovalQueue,
  approveQueueItem,
  rejectQueueItem,
  getApprovalSettings,
  updateApprovalSettings,
} = require('../Controllers/adminApprovalController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.catalog.approve'));

router.get('/settings', getApprovalSettings);
router.put('/settings', updateApprovalSettings);

router.get('/', listApprovalQueue);
router.post('/:id/approve', approveQueueItem);
router.post('/:id/reject', rejectQueueItem);

module.exports = router;
