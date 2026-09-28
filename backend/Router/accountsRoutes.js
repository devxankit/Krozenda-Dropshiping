const express = require('express');
const accounts = require('../Controllers/accountsController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

// Accounts MVP — separate screens from the accounting module, but the same
// permission keys: reading the ledger is accounting.view, and recording a
// payout (which lowers what a seller is shown as owed) or a gateway
// transaction are the accounting write keys.
const router = express.Router();

const VIEW = requirePermission('admin.accounting.view');

router.use(protectAdmin);

router.get('/dashboard', VIEW, accounts.getDashboardSummary);
router.get('/ledger', VIEW, accounts.listLedger);

router.get('/payouts/summary', VIEW, accounts.getVendorPayoutSummary);
router.get('/payouts', VIEW, accounts.listVendorPayouts);
router.post('/payouts', requirePermission('admin.accounting.payout.manage'), accounts.createVendorPayout);

router.get('/transactions', VIEW, accounts.listTransactions);
router.post('/transactions', requirePermission('admin.accounting.post'), accounts.createTransaction);

module.exports = router;
