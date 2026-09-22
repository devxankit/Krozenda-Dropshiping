const express = require('express');
const accounts = require('../Controllers/accountsController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

// Accounts MVP — plain admin-auth only, no per-screen permission keys (this
// is deliberately separate from the existing accounting module's
// requirePermission('admin.accounting.*') scheme).
const router = express.Router();

router.use(protectAdmin);

router.get('/dashboard', accounts.getDashboardSummary);
router.get('/ledger', accounts.listLedger);

router.get('/payouts/summary', accounts.getVendorPayoutSummary);
router.get('/payouts', accounts.listVendorPayouts);
router.post('/payouts', accounts.createVendorPayout);

router.get('/transactions', accounts.listTransactions);
router.post('/transactions', accounts.createTransaction);

module.exports = router;
