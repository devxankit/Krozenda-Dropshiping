const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const Vendor = require('../Models/Vendor');
const Payout = require('../Models/Payout');
const Order = require('../Models/Order');

// GET /admin/shell-summary — the sidebar badges and the notification tray,
// on every admin screen. It used to exist only as frontend fixture data, so a
// build without VITE_USE_MOCKS=false showed made-up counts and alerts ("2
// payouts failed — Nova Retail…"), and a build with it got a 404 on every page.
//
// Everything here is real, current, and scoped: each figure is only computed
// for an admin, or staff whose role covers that module — a support agent's
// tray does not tell them how many payouts failed.
//
// The tray lists what needs someone now, derived from the same figures,
// rather than a history: admin alerts are delivered live (socket + push) and
// are not stored.

const OPEN_RETURN_STATUSES = ReturnRequest.BLOCKING_STATUSES; // PENDING, ACCEPTED, APPROVED
const KYC_WAITING = ['PENDING', 'UNDER_REVIEW'];

function can(req, key) {
  return req.admin.role === 'admin' || req.permissions.includes(key);
}

async function countIf(allowed, query) {
  return allowed ? query : 0;
}

async function getShellSummary(req, res) {
  const [productApprovals, openReturns, pendingKyc, failedPayouts, deliveryUnconfirmed] = await Promise.all([
    countIf(can(req, 'admin.catalog.approve'), Product.countDocuments({ approvalStatus: 'PENDING', importPreview: { $ne: true } })),
    countIf(can(req, 'admin.returns.manage'), ReturnRequest.countDocuments({ status: { $in: OPEN_RETURN_STATUSES } })),
    countIf(can(req, 'admin.kyc.review'), Vendor.countDocuments({ verificationStatus: { $in: KYC_WAITING } })),
    countIf(
      can(req, 'admin.accounting.payout.view') || can(req, 'admin.finance.view'),
      Payout.countDocuments({ status: 'FAILED' })
    ),
    // Orders are admin-only (adminOrderRoutes: requireRole('admin')).
    countIf(
      req.admin.role === 'admin',
      Order.countDocuments({ items: { $elemMatch: { status: 'DELIVERED', deliveryConfirmedBy: 'SELLER' } } })
    ),
  ]);

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const notifications = [
    failedPayouts > 0 && {
      id: 'failed-payouts',
      tone: 'danger',
      title: `${plural(failedPayouts, 'payout', 'payouts')} failed`,
      body: 'Check the seller bank details and retry from Vendor Payouts.',
      to: '/admin/accounts/payouts',
    },
    deliveryUnconfirmed > 0 && {
      id: 'delivery-unconfirmed',
      tone: 'warning',
      title: `${plural(deliveryUnconfirmed, 'order', 'orders')} awaiting delivery confirmation`,
      body: 'Marked delivered by the seller only — held from payout until confirmed.',
      to: '/admin/orders?tab=delivery_unconfirmed',
    },
    productApprovals > 0 && {
      id: 'product-approvals',
      tone: 'brand',
      title: `${plural(productApprovals, 'product', 'products')} awaiting approval`,
      body: 'Seller listings stay hidden from buyers until approved.',
      to: '/admin/catalog/approvals',
    },
    pendingKyc > 0 && {
      id: 'pending-kyc',
      tone: 'brand',
      title: `${plural(pendingKyc, 'seller', 'sellers')} awaiting KYC review`,
      body: 'They cannot sell until their documents are approved.',
      to: '/admin/people/kyc',
    },
    openReturns > 0 && {
      id: 'open-returns',
      tone: 'warning',
      title: `${plural(openReturns, 'return', 'returns')} open`,
      body: 'Return and replacement requests waiting on a decision or a refund.',
      to: '/admin/orders/returns',
    },
  ]
    .filter(Boolean)
    .map((item) => ({ ...item, at: 'now', read: false }));

  res.json({
    success: true,
    data: {
      counts: { productApprovals, openReturns, pendingKyc, failedPayouts },
      notifications,
    },
  });
}

module.exports = { getShellSummary };
