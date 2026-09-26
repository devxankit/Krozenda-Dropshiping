const Vendor = require('../Models/Vendor');
const razorpayRouteService = require('./razorpayRouteService');

// Gets an approved seller from "has a bank account on file" to "Razorpay can
// settle Route transfers to them", with no admin click in between:
//
//   linked account -> stakeholder -> `route` product -> settlement bank account
//
// then keeps polling the product's activation until Razorpay activates it.
// Every step is idempotent on the id it stored, so a failure halfway (bad
// PAN, Razorpay down) just resumes from that step on the next call.
//
// Eligibility follows Razorpay's own activation — that is the fact that
// matters for whether a transfer can land — except when an admin has set
// it by hand (eligibilitySetBy: 'ADMIN'), which is never overridden here.

// Statuses the automation still has work to do on.
const IN_PROGRESS_STATUSES = ['NOT_STARTED', 'PENDING', 'ONBOARDING', 'KYC_PENDING'];

function applyStatus(vendor, onboardingStatus) {
  vendor.razorpay.onboardingStatus = onboardingStatus;
  vendor.razorpay.onboardingError = '';
  vendor.razorpay.lastSyncedAt = new Date();

  if (vendor.razorpay.eligibilitySetBy === 'ADMIN') return;
  if (onboardingStatus === 'ACTIVE') {
    vendor.razorpay.isSettlementEligible = true;
    vendor.razorpay.eligibilitySetBy = 'SYSTEM';
  } else if (['REJECTED', 'SUSPENDED'].includes(onboardingStatus)) {
    vendor.razorpay.isSettlementEligible = false;
    vendor.razorpay.eligibilitySetBy = 'SYSTEM';
  }
}

async function recordError(vendor, err) {
  vendor.razorpay.onboardingError = razorpayRouteService.errorText(err).slice(0, 500);
  vendor.razorpay.lastSyncedAt = new Date();
  await vendor.save();
}

async function loadVendor(vendorOrId) {
  if (vendorOrId && typeof vendorOrId.save === 'function') return vendorOrId;
  return Vendor.findById(vendorOrId);
}

/**
 * Run (or resume) the full Route onboarding for one seller.
 *
 * @param {object|string} vendorOrId  A Vendor document (saved onto) or its id.
 * @returns {Promise<object>} { ok, onboardingStatus?, skipped?, message? }
 */
async function onboardVendor(vendorOrId) {
  const vendor = await loadVendor(vendorOrId);
  if (!vendor) return { ok: false, skipped: true, message: 'Vendor not found' };

  if (vendor.verificationStatus !== 'APPROVED') {
    return { ok: false, skipped: true, message: 'Seller is not approved yet' };
  }
  if (!vendor.bank?.accountNumber || !vendor.bank?.ifsc) {
    return { ok: false, skipped: true, message: 'Seller has no bank account on file' };
  }

  vendor.razorpay = vendor.razorpay || {};
  try {
    await razorpayRouteService.createLinkedAccount(vendor);
    await razorpayRouteService.ensureStakeholder(vendor);
    const product = await razorpayRouteService.ensureRouteProduct(vendor);
    applyStatus(vendor, razorpayRouteService.mapAccountStatusToOnboardingStatus(product?.activation_status));
    await vendor.save();
    return { ok: true, onboardingStatus: vendor.razorpay.onboardingStatus };
  } catch (err) {
    await recordError(vendor, err);
    return { ok: false, message: vendor.razorpay.onboardingError };
  }
}

/**
 * Bring one seller's onboarding forward: finish any missing step, or — once
 * every step is done — re-read Razorpay's activation for the product.
 */
async function syncVendorOnboarding(vendorOrId) {
  const vendor = await loadVendor(vendorOrId);
  if (!vendor) return { ok: false, skipped: true, message: 'Vendor not found' };

  const rzp = vendor.razorpay || {};
  if (!rzp.accountId || !rzp.stakeholderId || !rzp.productId || rzp.bankSyncPending) {
    const result = await onboardVendor(vendor);
    if (result.ok && vendor.razorpay.bankSyncPending) {
      vendor.razorpay.bankSyncPending = false;
      await vendor.save();
    }
    return result;
  }

  try {
    const { onboardingStatus } = await razorpayRouteService.fetchRouteProductStatus(vendor);
    applyStatus(vendor, onboardingStatus);
    await vendor.save();
    return { ok: true, onboardingStatus };
  } catch (err) {
    await recordError(vendor, err);
    return { ok: false, message: vendor.razorpay.onboardingError };
  }
}

/**
 * Call before saving a seller whose bank details may have been edited. If
 * the payout account really changed on an onboarded seller, payouts pause
 * until the new account is on Razorpay and re-activated — a hijacked seller
 * login must not be able to redirect the next automatic payout. Mutates the
 * document; the caller saves it.
 */
function markBankChanged(vendor, previousBank = {}) {
  const normalize = (value) => String(value || '').replace(/\s+/g, '').toUpperCase();
  const changed =
    normalize(previousBank.accountNumber) !== normalize(vendor.bank?.accountNumber) ||
    normalize(previousBank.ifsc) !== normalize(vendor.bank?.ifsc);
  if (!changed || !vendor.razorpay?.accountId) return false;

  vendor.razorpay.bankSyncPending = true;
  vendor.razorpay.isSettlementEligible = false;
  vendor.razorpay.eligibilitySetBy = 'SYSTEM';
  vendor.razorpay.onboardingStatus = 'ONBOARDING';
  return true;
}

/**
 * Every approved seller with bank details whose onboarding is not finished
 * yet, one at a time (polite to the Razorpay API). Used by the automation job.
 */
async function syncPendingVendors() {
  const vendors = await Vendor.find({
    verificationStatus: 'APPROVED',
    isActive: true,
    'bank.accountNumber': { $nin: [null, ''] },
    'bank.ifsc': { $nin: [null, ''] },
    'razorpay.onboardingStatus': { $in: IN_PROGRESS_STATUSES },
  });

  const summary = { checked: vendors.length, active: 0, failed: 0 };
  for (const vendor of vendors) {
    const result = await syncVendorOnboarding(vendor);
    if (result.onboardingStatus === 'ACTIVE') summary.active += 1;
    if (!result.ok && !result.skipped) summary.failed += 1;
  }
  return summary;
}

module.exports = { onboardVendor, syncVendorOnboarding, syncPendingVendors, markBankChanged, IN_PROGRESS_STATUSES };
