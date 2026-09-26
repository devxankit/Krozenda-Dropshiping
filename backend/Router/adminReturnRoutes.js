const express = require('express');
const {
  listReturnRequests,
  getReturnDetail,
  decideReturnRequest,
  markReturnReceived,
  completeReturnRequest,
} = require('../Controllers/adminReturnController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.returns.manage'));

router.get('/', listReturnRequests);
router.get('/:id', getReturnDetail);
router.patch('/:id/decision', decideReturnRequest);
router.post('/:id/decide', decideReturnRequest);
router.post('/:id/received', markReturnReceived);
router.post('/:id/complete', completeReturnRequest);

module.exports = router;
