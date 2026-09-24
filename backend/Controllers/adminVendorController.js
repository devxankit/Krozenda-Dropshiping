const Vendor = require('../Models/Vendor');
const VendorDocument = require('../Models/VendorDocument');
const Product = require('../Models/Product');
const Order = require('../Models/Order');
const Notification = require('../Models/Notification');
const { sendToTokens } = require('../utils/pushHelper');
const { serializeVendor, createVendorAccount } = require('./vendorAuthController');
const { serializeDocument } = require('./vendorDocumentController');
const razorpayRouteService = require('../services/razorpayRouteService');
const emailService = require('../services/emailService');

// Live SKU count and gross sales per vendor, read from the catalog and the
// order line items that snapshot their vendor at order time — the directory
// showed hardcoded zeros before this.
async function vendorTradeStats() {
  const [skuRows, salesRows] = await Promise.all([
    Product.aggregate([
      { $match: { vendor: { $ne: null } } },
      { $group: { _id: '$vendor', products: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { status: { $ne: 'CANCELLED' } } },
      { $unwind: '$items' },
      { $match: { 'items.vendor': { $ne: null } } },
      {
        $group: {
          _id: '$items.vendor',
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orders: { $addToSet: '$_id' },
        },
      },
    ]),
  ]);

  const byVendor = new Map();
  for (const row of skuRows) {
    byVendor.set(row._id.toString(), { products: row.products, orders: 0, revenue: 0 });
  }
  for (const row of salesRows) {
    const key = row._id.toString();
    const existing = byVendor.get(key) || { products: 0, orders: 0, revenue: 0 };
    existing.orders = row.orders.length;
    // The admin panel renders money as paise; Order stores rupees.
    existing.revenue = Math.round(row.revenue * 100);
    byVendor.set(key, existing);
  }
  return byVendor;
}

async function listVendors(req, res) {
  const { vendorType, verificationStatus } = req.query;
  const filter = {};
  if (vendorType && ['B2C', 'B2B'].includes(vendorType)) filter.vendorType = vendorType;
  if (verificationStatus) filter.verificationStatus = verificationStatus;

  const [vendors, tradeStats] = await Promise.all([
    Vendor.find(filter).sort({ createdAt: -1 }).lean(),
    vendorTradeStats(),
  ]);

  const items = vendors.map((v) => ({
    ...serializeVendor(v),
    ...(tradeStats.get(v._id.toString()) || { products: 0, orders: 0, revenue: 0 }),
  }));

  const stats = {
    total: items.length,
    pending: items.filter((v) => v.verificationStatus === 'PENDING').length,
    underReview: items.filter((v) => v.verificationStatus === 'UNDER_REVIEW').length,
    approved: items.filter((v) => v.verificationStatus === 'APPROVED').length,
    rejected: items.filter((v) => v.verificationStatus === 'REJECTED').length,
    active: items.filter((v) => v.isActive).length,
  };

  res.json({ success: true, data: { items, stats } });
}

// POST /admin/vendors — one-step partner onboarding from the panel. Same
// validation as the vendor's own sign-up (B2B needs a business and an
// authorised contact, B2C doesn't), but an admin may approve and activate
// the partner immediately instead of waiting on the KYC queue.
async function createVendor(req, res) {
  const approveNow = req.body.approveNow === true || req.body.approveNow === 'true';

  const { error, vendor } = await createVendorAccount(req.body, {
    verificationStatus: approveNow ? 'APPROVED' : 'PENDING',
    isActive: approveNow,
  });
  if (error) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  // A partner an admin activates on the spot never passes through the KYC
  // queue, so this is the only point they learn the account is live.
  if (approveNow) emailService.sendVendorAccountApproved(vendor);

  res.status(201).json({
    success: true,
    message: approveNow ? 'Partner onboarded and activated' : 'Partner registered, awaiting verification',
    data: { ...serializeVendor(vendor), products: 0, orders: 0, revenue: 0 },
  });
}

async function getVendor(req, res) {
  const { id } = req.params;

  const vendor = await Vendor.findById(id);
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  const documents = await VendorDocument.find({ vendorId: id }).sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    data: {
      vendor: serializeVendor(vendor),
      documents: documents.map(serializeDocument),
    },
  });
}

// PENDING/REJECTED -> UNDER_REVIEW happens on the vendor's own side
// (submitForVerification). From here admins move UNDER_REVIEW -> APPROVED
// (which also flips isActive on, so the vendor goes live immediately) or
// UNDER_REVIEW -> REJECTED (with a reason so the vendor knows what to fix).
async function updateVendorStatus(req, res) {
  const { id } = req.params;
  const { verificationStatus, rejectionReason } = req.body;

  const allowed = ['UNDER_REVIEW', 'APPROVED', 'REJECTED'];
  if (!verificationStatus || !allowed.includes(verificationStatus)) {
    return res.status(400).json({ success: false, message: `verificationStatus must be one of ${allowed.join(', ')}` });
  }

  if (verificationStatus === 'REJECTED' && !rejectionReason?.trim()) {
    return res.status(400).json({ success: false, message: 'rejectionReason is required when rejecting a vendor' });
  }

  const vendor = await Vendor.findById(id);
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  const previousStatus = vendor.verificationStatus;
  vendor.verificationStatus = verificationStatus;
  vendor.rejectionReason = verificationStatus === 'REJECTED' ? rejectionReason.trim() : '';
  if (verificationStatus === 'APPROVED') {
    vendor.isActive = true;
  }
  if (verificationStatus === 'REJECTED') {
    vendor.isActive = false;
  }

  await vendor.save();

  // Email on every rejection (the reason may have changed), but on approval
  // only when the account actually becomes active, so re-saving an already
  // approved vendor doesn't resend it. Fire and forget: never throws.
  if (verificationStatus === 'APPROVED' && previousStatus !== 'APPROVED') {
    emailService.sendVendorAccountApproved(vendor);
  } else if (verificationStatus === 'REJECTED') {
    emailService.sendVendorApplicationRejected(vendor, vendor.rejectionReason);
  }

  // Dispatch English notification to seller
  if (verificationStatus === 'APPROVED') {
    try {
      await Notification.create({
        vendor: vendor._id,
        title: 'Seller Account Approved!',
        message: 'Congratulations! Your seller account has been approved by the Admin team. You can now access your dashboard, list products, and start selling on Krozenda.',
        type: 'SYSTEM',
        actionType: 'NONE',
      });
      const tokens = (vendor.fcmTokens || []).map((t) => t.token);
      if (tokens.length > 0) {
        await sendToTokens(tokens, {
          title: 'Seller Account Approved!',
          body: 'Congratulations! Your seller account has been approved by Admin. You can now log in and start selling on Krozenda.',
          data: { type: 'seller_approved' },
        });
      }
    } catch (err) {
      console.error('Failed to notify vendor on approval:', err);
    }
  } else if (verificationStatus === 'REJECTED') {
    try {
      await Notification.create({
        vendor: vendor._id,
        title: 'Seller Application Update',
        message: rejectionReason?.trim()
          ? `Your seller application could not be approved: ${rejectionReason.trim()}. Please update your documents and resubmit.`
          : 'Your seller application could not be approved. Please review your documents and resubmit.',
        type: 'SYSTEM',
        actionType: 'NONE',
      });
      const tokens = (vendor.fcmTokens || []).map((t) => t.token);
      if (tokens.length > 0) {
        await sendToTokens(tokens, {
          title: 'Seller Application Update',
          body: 'Your seller application could not be approved. Please review the feedback and resubmit.',
          data: { type: 'seller_rejected' },
        });
      }
    } catch (err) {
      console.error('Failed to notify vendor on rejection:', err);
    }
  }

  res.json({
    success: true,
    message: `Vendor marked ${verificationStatus.toLowerCase().replace('_', ' ')}`,
    data: { vendor: serializeVendor(vendor) },
  });
}

// Independent of the verification pipeline — suspends/reactivates a vendor
// that has already been approved, without touching verificationStatus.
async function toggleVendorActive(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: 'isActive is required' });
  }

  const vendor = await Vendor.findById(id);
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  if (vendor.verificationStatus !== 'APPROVED' && (isActive === true || isActive === 'true')) {
    return res.status(400).json({ success: false, message: 'Only approved vendors can be activated' });
  }

  vendor.isActive = isActive === true || isActive === 'true';
  await vendor.save();

  res.json({
    success: true,
    message: `Vendor ${vendor.isActive ? 'activated' : 'deactivated'}`,
    data: { vendor: serializeVendor(vendor) },
  });
}

async function reviewVendorDocument(req, res) {
  const { vendorId, documentId } = req.params;
  const { status, rejectionReason } = req.body;

  const allowed = ['APPROVED', 'REJECTED'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `status must be one of ${allowed.join(', ')}` });
  }

  if (status === 'REJECTED' && !rejectionReason?.trim()) {
    return res.status(400).json({ success: false, message: 'rejectionReason is required when rejecting a document' });
  }

  const doc = await VendorDocument.findOne({ _id: documentId, vendorId });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  doc.status = status;
  doc.rejectionReason = status === 'REJECTED' ? rejectionReason.trim() : '';
  doc.verifiedBy = req.admin._id;
  doc.verifiedAt = new Date();
  await doc.save();

  if (status === 'REJECTED') {
    const vendor = await Vendor.findById(vendorId).select('name email vendorType');
    if (vendor) emailService.sendVendorDocumentRejected(vendor, doc);
  }

  res.json({
    success: true,
    message: `Document ${status.toLowerCase()}`,
    data: serializeDocument(doc),
  });
}

// POST /admin/vendors/:id/razorpay/sync
//
// The human checkpoint the Route integration needs: the SDK's own
// account-status-string -> onboardingStatus mapping
// (razorpayRouteService.mapAccountStatusToOnboardingStatus) is not fully
// confirmed, so an admin who has actually looked at this vendor's linked
// account on the Razorpay dashboard can override what the automated sync
// concluded. Ensures the linked account exists (idempotent — createLinkedAccount
// no-ops if vendor.razorpay.accountId is already set), then lets the admin
// set isSettlementEligible and/or onboardingStatus directly.
//
// No amount, bank detail, or anything financial is accepted here beyond the
// linked-account bookkeeping itself — this endpoint only ever flips
// eligibility flags on a vendor already reviewed elsewhere in this same
// controller (updateVendorStatus / reviewVendorDocument).
const RAZORPAY_ONBOARDING_STATUSES = ['NOT_STARTED', 'PENDING', 'ONBOARDING', 'KYC_PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'];

async function syncVendorRazorpay(req, res) {
  const { id } = req.params;
  const { isSettlementEligible, onboardingStatus } = req.body;

  if (onboardingStatus !== undefined && !RAZORPAY_ONBOARDING_STATUSES.includes(onboardingStatus)) {
    return res.status(400).json({ success: false, message: `onboardingStatus must be one of ${RAZORPAY_ONBOARDING_STATUSES.join(', ')}` });
  }
  if (isSettlementEligible !== undefined && typeof isSettlementEligible !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isSettlementEligible must be true or false' });
  }

  const vendor = await Vendor.findById(id);
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  try {
    // Idempotent: no-ops and returns the existing id if already linked.
    await razorpayRouteService.createLinkedAccount(vendor);
  } catch (err) {
    return res.status(502).json({
      success: false,
      message: err?.error?.description || err.message || 'Could not create/sync the Razorpay linked account',
    });
  }

  if (isSettlementEligible !== undefined) {
    vendor.razorpay.isSettlementEligible = isSettlementEligible;
  }
  if (onboardingStatus !== undefined) {
    vendor.razorpay.onboardingStatus = onboardingStatus;
  }
  vendor.razorpay.lastSyncedAt = new Date();
  await vendor.save();

  res.json({
    success: true,
    message: 'Vendor Razorpay linked account synced',
    data: {
      vendorId: String(vendor._id),
      razorpay: {
        accountId: vendor.razorpay.accountId || null,
        onboardingStatus: vendor.razorpay.onboardingStatus,
        kycStatus: vendor.razorpay.kycStatus || null,
        isSettlementEligible: Boolean(vendor.razorpay.isSettlementEligible),
        lastSyncedAt: vendor.razorpay.lastSyncedAt,
      },
      // Masked, never the full number — see razorpayRouteService.maskAccountNumber.
      bankAccountMasked: razorpayRouteService.maskAccountNumber(vendor.bank?.accountNumber),
    },
  });
}

module.exports = {
  listVendors,
  getVendor,
  createVendor,
  updateVendorStatus,
  toggleVendorActive,
  reviewVendorDocument,
  syncVendorRazorpay,
};
