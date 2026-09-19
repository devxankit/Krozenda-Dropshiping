const express = require('express');
const {
  listDisputes,
  getDispute,
  createDispute,
  cancelDispute,
  refreshStatus,
} = require('../Controllers/adminCjDisputeController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.cj.returns'));

router.get('/', listDisputes);
router.post('/', createDispute);
router.get('/:id', getDispute);
router.post('/:id/cancel', cancelDispute);
router.post('/:id/refresh-status', refreshStatus);

module.exports = router;
