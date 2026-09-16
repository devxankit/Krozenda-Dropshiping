const express = require('express');
const rateLimit = require('express-rate-limit');
const accounting = require('../Controllers/adminAccountingController');
const commission = require('../Controllers/adminCommissionController');
const settlement = require('../Controllers/adminSettlementController');
const reports = require('../Controllers/adminAccountingReportController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

// Accounting is the most sensitive surface in the panel, so the permissions
// are per-screen rather than one blanket key: a CA/auditor reads everything
// and touches nothing, a settlements clerk drafts batches, and only someone
// with the payout key can actually move money.
//
// `admin.accounting.view` remains the umbrella read key and is accepted
// alongside the specific one everywhere, so a role that already had it does
// not lose access when this module ships.
const any = (...keys) => (req, res, next) => {
  if (req.admin?.role === 'admin') return next();
  if (keys.some((key) => req.permissions.includes(key))) return next();
  return res.status(403).json({ success: false, message: 'You do not have access to this module' });
};

const VIEW = any('admin.accounting.view');
const TRANSACTIONS_VIEW = any('admin.accounting.transactions.view', 'admin.accounting.view');
const LEDGER_VIEW = any('admin.accounting.ledger.view', 'admin.accounting.view');
const COMMISSION_VIEW = any('admin.accounting.commission.view', 'admin.accounting.view');
const COMMISSION_MANAGE = requirePermission('admin.accounting.commission.manage');
const SETTLEMENT_VIEW = any('admin.accounting.settlement.view', 'admin.accounting.view');
const SETTLEMENT_MANAGE = requirePermission('admin.accounting.settlement.manage');
const PAYOUT_VIEW = any('admin.accounting.payout.view', 'admin.accounting.view');
const PAYOUT_MANAGE = requirePermission('admin.accounting.payout.manage');
const REFUND_VIEW = any('admin.accounting.refund.view', 'admin.accounting.view');
const REFUND_MANAGE = requirePermission('admin.accounting.refund.manage');
const REPORT_VIEW = any('admin.accounting.report.view', 'admin.accounting.view');
const ADJUSTMENT_MANAGE = requirePermission('admin.accounting.post');

// Money-moving endpoints get their own throttle on top of the global one.
// Not a substitute for the idempotency keys in services/payoutService.js —
// those are what actually prevent a duplicate payout — but it keeps a
// misbehaving client or a stuck retry loop from hammering them.
const moneyMovementLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.ENV === 'test',
  message: { success: false, message: 'Too many payment operations. Please slow down.' },
});

router.use(protectAdmin);

// --- overview --------------------------------------------------------------
router.get('/overview', VIEW, accounting.getOverview);

// --- transactions ----------------------------------------------------------
// The two static paths are declared before '/:id' so "cod-pending" is never
// parsed as a transaction id.
router.get('/transactions/cod-pending', TRANSACTIONS_VIEW, accounting.listPendingCod);
router.post('/transactions/cod-remittance', moneyMovementLimiter, ADJUSTMENT_MANAGE, accounting.recordCodRemittance);
router.get('/transactions', TRANSACTIONS_VIEW, accounting.listTransactions);
router.get('/transactions/:id', TRANSACTIONS_VIEW, accounting.getTransaction);

// --- seller ledger ---------------------------------------------------------
router.get('/seller-ledger', LEDGER_VIEW, accounting.listSellerLedgers);
router.get('/seller-ledger/:sellerId', LEDGER_VIEW, accounting.getSellerLedger);
router.post('/seller-ledger/:sellerId/adjustments', moneyMovementLimiter, ADJUSTMENT_MANAGE, accounting.createAdjustment);

// --- commissions -----------------------------------------------------------
router.get('/commissions/options', COMMISSION_VIEW, commission.getCommissionRuleOptions);
router.get('/commissions', COMMISSION_VIEW, commission.listCommissionRules);
router.post('/commissions', COMMISSION_MANAGE, commission.createCommissionRule);
router.put('/commissions/:id', COMMISSION_MANAGE, commission.updateCommissionRule);
router.patch('/commissions/:id/status', COMMISSION_MANAGE, commission.setCommissionRuleStatus);

// --- accounting policy -----------------------------------------------------
router.get('/config', VIEW, commission.getAccountingConfig);
router.patch('/config', COMMISSION_MANAGE, commission.updateAccountingConfig);

// --- settlements -----------------------------------------------------------
router.post('/settlements/generate', SETTLEMENT_MANAGE, settlement.generateSettlements);
router.get('/settlements', SETTLEMENT_VIEW, settlement.listSettlements);
router.get('/settlements/:id', SETTLEMENT_VIEW, settlement.getSettlement);
router.post('/settlements/:id/hold', SETTLEMENT_MANAGE, settlement.holdSettlement);
router.post('/settlements/:id/release', SETTLEMENT_MANAGE, settlement.releaseSettlement);

// --- payouts ---------------------------------------------------------------
router.get('/payouts', PAYOUT_VIEW, settlement.listPayouts);
router.post('/payouts', moneyMovementLimiter, PAYOUT_MANAGE, settlement.createPayout);
router.get('/payouts/:id', PAYOUT_VIEW, settlement.getPayout);
router.patch('/payouts/:id/status', moneyMovementLimiter, PAYOUT_MANAGE, settlement.updatePayoutStatus);

// --- refunds ---------------------------------------------------------------
router.get('/refunds', REFUND_VIEW, settlement.listRefunds);
router.get('/refunds/:id', REFUND_VIEW, settlement.getRefund);
router.post('/refunds/:id/approve', moneyMovementLimiter, REFUND_MANAGE, settlement.approveRefund);
router.post('/refunds/:id/reject', moneyMovementLimiter, REFUND_MANAGE, settlement.rejectRefund);

// --- reports & audit -------------------------------------------------------
router.get('/reports', REPORT_VIEW, reports.listReports);
router.get('/reports/:reportKey', REPORT_VIEW, reports.runReport);
router.get('/audit-log', VIEW, reports.listAuditLog);

module.exports = router;
