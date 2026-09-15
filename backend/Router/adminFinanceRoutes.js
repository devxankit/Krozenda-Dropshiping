const express = require('express');
const {
  getOverview,
  listTransactions,
  reconcileTransaction,
  bulkReconcileTransactions,
  listRefunds,
  processRefund,
  rejectRefund,
  listSettlements,
  getSettlementBatch,
  approveSettlement,
  rejectSettlement,
  retrySettlement,
  listVendorLedgers,
  getVendorStatement,
  listCommissionRules,
  updateVendorCommissionRate,
} = require('../Controllers/adminFinanceController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

const VIEW = requirePermission('admin.finance.view');
const MANAGE = requirePermission('admin.finance.manage');

router.use(protectAdmin);

router.get('/overview', VIEW, getOverview);

router.get('/transactions', VIEW, listTransactions);
router.patch('/transactions/:id/reconcile', MANAGE, reconcileTransaction);
router.patch('/transactions/reconcile', MANAGE, bulkReconcileTransactions);

router.get('/refunds', VIEW, listRefunds);
router.post('/refunds/:id/process', MANAGE, processRefund);
router.post('/refunds/:id/reject', MANAGE, rejectRefund);

router.get('/settlements', VIEW, listSettlements);
router.get('/settlements/:id', VIEW, getSettlementBatch);
router.post('/settlements/:id/approve', MANAGE, approveSettlement);
router.post('/settlements/:id/reject', MANAGE, rejectSettlement);
router.post('/settlements/:id/retry', MANAGE, retrySettlement);

router.get('/vendor-ledger', VIEW, listVendorLedgers);
router.get('/vendor-ledger/:id', VIEW, getVendorStatement);

router.get('/commission-rules', VIEW, listCommissionRules);
router.patch('/commission-rules/:id', MANAGE, updateVendorCommissionRate);

module.exports = router;
