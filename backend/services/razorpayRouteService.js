const razorpay = require('../Config/razorpay');

// Razorpay Route service — creates linked (sub-merchant) accounts, moves
// money to them via transfers on captured payments, releases settlement
// holds, and reverses transfers.
//
// SDK methods used below were confirmed by READING THE INSTALLED SDK SOURCE
// (not just docs), at:
//   backend/node_modules/razorpay/dist/resources/accounts.js
//   backend/node_modules/razorpay/dist/resources/transfers.js
//   backend/node_modules/razorpay/dist/resources/payments.js
//   backend/node_modules/razorpay/dist/types/accounts.d.ts
//   backend/node_modules/razorpay/dist/types/transfers.d.ts
//
// Confirmed calls (all present on the installed SDK — no raw HTTP fallback
// needed):
//   razorpay.accounts.create(params)                    -> POST /v2/accounts
//   razorpay.payments.transfer(paymentId, params)        -> POST /v1/payments/:id/transfers
//   razorpay.transfers.edit(transferId, params)          -> PATCH /v1/transfers/:id
//   razorpay.transfers.reverse(transferId, params)       -> POST /v1/transfers/:id/reversals
//
// `transfers.reverse(transferId, { amount })` takes an OPTIONAL `amount` (see
// transfers.d.ts: `params?: { amount: number }`) — the SDK type declares
// amount as optional, which per Razorpay's Route reversal docs means a
// partial reversal is supported by passing a smaller amount, and a full
// reversal by omitting it. This is based on the SDK's own type declaration,
// not a live call, so re-verify against a sandbox transfer before relying on
// it for the first real partial reversal.
//
// If Razorpay ever changes/removes these methods, re-check the same files
// under node_modules/razorpay/dist — do not guess method names.

// Never let a bank account number reach a log line. Keeps only the last 4
// digits, matching the masking convention in services/payoutService.js.
function maskAccountNumber(accountNumber) {
  const digits = String(accountNumber || '').replace(/\s+/g, '');
  if (digits.length < 4) return '';
  return `XXXX XXXX ${digits.slice(-4)}`;
}

// Razorpay's linked-account `status` (per accounts.d.ts: `status: string`,
// undocumented exact enum in the type file) is mapped to our own
// onboardingStatus enum conservatively — anything not recognized falls back
// to ONBOARDING rather than guessing ACTIVE.
function mapAccountStatusToOnboardingStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'activated') return 'ACTIVE';
  if (normalized === 'under_review' || normalized === 'needs_clarification') return 'KYC_PENDING';
  if (normalized === 'rejected') return 'REJECTED';
  if (normalized === 'suspended') return 'SUSPENDED';
  if (normalized === 'created' || normalized === 'requested') return 'ONBOARDING';
  return 'ONBOARDING';
}

// How a settlement reaches the seller:
//
//   payment (default) — a transfer against the ONE captured payment that
//     paid for the batch's lines (POST /payments/:id/transfers), created on
//     hold and released later. Needs a batch per payment, which
//     settlementService.generateSettlements produces in this mode. Cannot
//     pay COD/wallet lines — there is no payment to transfer from.
//   direct — a transfer from the platform's Razorpay balance
//     (POST /transfers). One transfer per seller batch, COD included, but it
//     cannot be put on hold, so it is only created once the batch is due.
//     Razorpay has to enable direct transfers on the account first.
function transferMode() {
  return String(process.env.RAZORPAY_ROUTE_TRANSFER_MODE || '').toLowerCase() === 'direct' ? 'direct' : 'payment';
}

function errorText(err) {
  return err?.error?.description || err?.message || String(err);
}

// A personal PAN has P as its fourth character. A stakeholder is a person,
// so a company/firm PAN is never sent as their KYC.
function personalPan(pan) {
  const value = String(pan || '').trim().toUpperCase();
  return /^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/.test(value) ? value : '';
}

/**
 * Add the seller's contact person as the linked account's stakeholder.
 * Idempotent on vendor.razorpay.stakeholderId. Saves onto `vendor`.
 */
async function ensureStakeholder(vendor) {
  if (vendor.razorpay?.stakeholderId) return vendor.razorpay.stakeholderId;

  const contactPerson = vendor.contactPerson || {};
  const pan = personalPan(vendor.business?.pan);
  const payload = {
    name: contactPerson.name || vendor.name,
    email: contactPerson.email || vendor.email,
    phone: { primary: String(contactPerson.mobile || vendor.mobile || '').replace(/\D/g, '').slice(-10) },
    ...(pan ? { kyc: { pan } } : {}),
    notes: { vendorId: String(vendor._id) },
  };

  let stakeholder;
  try {
    stakeholder = await razorpay.stakeholders.create(vendor.razorpay.accountId, payload);
  } catch (err) {
    console.error(`[razorpayRouteService] ensureStakeholder failed for vendor ${vendor._id}:`, errorText(err));
    throw err;
  }

  vendor.razorpay.stakeholderId = stakeholder.id;
  await vendor.save();
  return stakeholder.id;
}

/**
 * Request the `route` product on the linked account and give it the seller's
 * settlement bank account — the step that actually tells Razorpay where the
 * seller's money goes. Idempotent on vendor.razorpay.productId for the
 * request; the bank details are (re)sent every call so a corrected account
 * reaches Razorpay. Saves onto `vendor` and returns the product.
 */
async function ensureRouteProduct(vendor) {
  const accountId = vendor.razorpay.accountId;
  const bank = vendor.bank || {};
  if (!bank.accountNumber || !bank.ifsc) {
    throw new Error('Seller has no bank account on file — cannot configure Razorpay Route settlements');
  }

  try {
    if (!vendor.razorpay.productId) {
      const requested = await razorpay.products.requestProductConfiguration(accountId, {
        product_name: 'route',
        tnc_accepted: true,
      });
      vendor.razorpay.productId = requested.id;
      await vendor.save();
    }

    return await razorpay.products.edit(accountId, vendor.razorpay.productId, {
      settlements: {
        account_number: String(bank.accountNumber).replace(/\s+/g, ''),
        ifsc_code: bank.ifsc,
        beneficiary_name: bank.accountHolderName || vendor.business?.businessName || vendor.name,
      },
      tnc_accepted: true,
    });
  } catch (err) {
    console.error(
      `[razorpayRouteService] ensureRouteProduct failed for vendor ${vendor._id} (bank ${maskAccountNumber(bank.accountNumber)}):`,
      errorText(err)
    );
    throw err;
  }
}

/**
 * The linked account's current Route activation, as our onboardingStatus.
 */
async function fetchRouteProductStatus(vendor) {
  const product = await razorpay.products.fetch(vendor.razorpay.accountId, vendor.razorpay.productId);
  return {
    activationStatus: product.activation_status || null,
    onboardingStatus: mapAccountStatusToOnboardingStatus(product.activation_status),
    requirements: Array.isArray(product.requirements) ? product.requirements : [],
  };
}

/**
 * Create a Razorpay Route linked account for a vendor. Idempotent: if the
 * vendor already has an accountId, that is returned without calling out.
 *
 * @param {object} vendor  A Vendor mongoose document (not lean) — this
 *   function saves onto it.
 * @returns {Promise<string>} The linked account id (acc_xxx).
 */
async function createLinkedAccount(vendor) {
  if (vendor?.razorpay?.accountId) {
    return vendor.razorpay.accountId;
  }

  const business = vendor.business || {};
  const contactPerson = vendor.contactPerson || {};
  const bank = vendor.bank || {};

  const payload = {
    email: vendor.email,
    phone: contactPerson.mobile || vendor.mobile,
    type: 'route',
    legal_business_name: business.businessName || vendor.name,
    customer_facing_business_name: business.tradeName || business.businessName || vendor.name,
    business_type: business.businessType || 'proprietorship',
    contact_name: contactPerson.name || vendor.name,
    profile: {
      category: 'ecommerce',
      subcategory: 'ecommerce',
      addresses: {
        registered: {
          street1: vendor.address?.addressLine || '',
          street2: '',
          city: vendor.address?.city || '',
          state: vendor.address?.state || '',
          postal_code: vendor.address?.pincode || '',
          country: vendor.address?.country || 'IN',
        },
      },
    },
    legal_info: {
      pan: business.pan || undefined,
      gst: business.gstin || undefined,
    },
    notes: {
      vendorId: String(vendor._id),
      bankLast4: maskAccountNumber(bank.accountNumber),
    },
  };

  let account;
  try {
    account = await razorpay.accounts.create(payload);
  } catch (err) {
    console.error(
      `[razorpayRouteService] createLinkedAccount failed for vendor ${vendor._id} (bank ${maskAccountNumber(bank.accountNumber)}):`,
      err?.error?.description || err.message || err
    );
    throw err;
  }

  vendor.razorpay = vendor.razorpay || {};
  vendor.razorpay.accountId = account.id;
  vendor.razorpay.onboardingStatus = mapAccountStatusToOnboardingStatus(account.status);
  vendor.razorpay.lastSyncedAt = new Date();
  await vendor.save();

  return account.id;
}

/**
 * Create a Route transfer on an already-captured payment, on hold until a
 * given time (so the platform can review/adjust before Razorpay settles it
 * to the seller).
 *
 * @param {object} options
 * @param {string} options.razorpayPaymentId
 * @param {string} options.vendorAccountId  The linked account id (acc_xxx).
 * @param {number} options.amountPaise      Positive integer, in paise.
 * @param {Date|number} [options.onHoldUntil]  A JS Date, or a unix timestamp
 *   (seconds) directly. A Date is converted to seconds; a number is passed
 *   through unchanged — callers should document which they're sending.
 * @param {object} [options.notes]
 * @returns {Promise<object>} The created transfer (includes `id`).
 */
async function createHeldTransfer({ razorpayPaymentId, vendorAccountId, amountPaise, onHoldUntil, notes = {} }) {
  if (!razorpayPaymentId) throw new Error('razorpayPaymentId is required');
  if (!vendorAccountId) throw new Error('vendorAccountId is required');
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('amountPaise must be a positive integer');
  }

  const payload = {
    transfers: [
      {
        account: vendorAccountId,
        amount: amountPaise,
        currency: 'INR',
        on_hold: true,
        notes,
      },
    ],
  };

  if (onHoldUntil !== undefined && onHoldUntil !== null) {
    const onHoldUntilSeconds =
      onHoldUntil instanceof Date ? Math.floor(onHoldUntil.getTime() / 1000) : onHoldUntil;
    payload.transfers[0].on_hold_until = onHoldUntilSeconds;
  }

  let response;
  try {
    response = await razorpay.payments.transfer(razorpayPaymentId, payload);
  } catch (err) {
    console.error(
      `[razorpayRouteService] createHeldTransfer failed for payment ${razorpayPaymentId} -> account ${vendorAccountId}:`,
      err?.error?.description || err.message || err
    );
    throw err;
  }

  // razorpay.payments.transfer() on a multi-transfer payload returns
  // { items: [transfer, ...] } per the transfers resource created via this
  // endpoint (payments.js posts to /payments/:id/transfers with the full
  // `transfers` array, mirroring transfers.create's single-object shape).
  const transfer = Array.isArray(response?.items) ? response.items[0] : response;
  if (!transfer?.id) {
    throw new Error('Razorpay did not return a transfer id for createHeldTransfer');
  }
  return transfer;
}

/**
 * A transfer from the platform's own Razorpay balance, not tied to any
 * payment — see transferMode(). Not holdable: the money is on its way the
 * moment this returns, so callers only make it once a settlement is due.
 */
async function createDirectTransfer({ vendorAccountId, amountPaise, notes = {} }) {
  if (!vendorAccountId) throw new Error('vendorAccountId is required');
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('amountPaise must be a positive integer');
  }

  try {
    const transfer = await razorpay.transfers.create({
      account: vendorAccountId,
      amount: amountPaise,
      currency: 'INR',
      notes,
    });
    if (!transfer?.id) throw new Error('Razorpay did not return a transfer id for createDirectTransfer');
    return transfer;
  } catch (err) {
    console.error(`[razorpayRouteService] createDirectTransfer failed -> account ${vendorAccountId}:`, errorText(err));
    throw err;
  }
}

async function fetchTransfer(transferId) {
  if (!transferId) throw new Error('transferId is required');
  return razorpay.transfers.fetch(transferId);
}

/**
 * Release a transfer's settlement hold so Razorpay proceeds to settle it.
 *
 * @param {string} transferId
 * @returns {Promise<object>} The updated transfer.
 */
async function releaseTransfer(transferId) {
  if (!transferId) throw new Error('transferId is required');

  try {
    return await razorpay.transfers.edit(transferId, { on_hold: false });
  } catch (err) {
    console.error(`[razorpayRouteService] releaseTransfer failed for transfer ${transferId}:`, err?.error?.description || err.message || err);
    throw err;
  }
}

/**
 * Reverse a transfer, full or partial.
 *
 * NOTE — partial reversal support: the installed SDK's type declaration
 * (transfers.d.ts) types `reverse(transferId, params?: { amount: number })`
 * with `amount` optional, which is consistent with Razorpay's documented
 * Route "reverse a transfer" endpoint supporting a partial `amount` and
 * defaulting to a full reversal when omitted. This has been confirmed only
 * from the SDK's TypeScript types, not from a live call or the prose docs —
 * treat the first real partial reversal as a verification point.
 *
 * @param {string} transferId
 * @param {number} amountPaise  Positive integer, in paise. Required here
 *   (always passed explicitly) so a caller cannot accidentally reverse more
 *   than intended by omitting it.
 * @returns {Promise<object>} The created reversal.
 */
async function reverseTransfer(transferId, amountPaise) {
  if (!transferId) throw new Error('transferId is required');
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('amountPaise must be a positive integer');
  }

  try {
    return await razorpay.transfers.reverse(transferId, { amount: amountPaise });
  } catch (err) {
    console.error(`[razorpayRouteService] reverseTransfer failed for transfer ${transferId}:`, err?.error?.description || err.message || err);
    throw err;
  }
}

module.exports = {
  createLinkedAccount,
  ensureStakeholder,
  ensureRouteProduct,
  fetchRouteProductStatus,
  createHeldTransfer,
  createDirectTransfer,
  fetchTransfer,
  releaseTransfer,
  reverseTransfer,
  maskAccountNumber,
  mapAccountStatusToOnboardingStatus,
  transferMode,
  errorText,
};
