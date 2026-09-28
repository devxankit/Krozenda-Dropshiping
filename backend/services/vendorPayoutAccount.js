const Vendor = require('../Models/Vendor');
const razorpayx = require('./razorpayxService');
const { alertAdmins } = require('./adminAlertService');

// A seller as a RazorpayX payee: one contact, and a bank fund account for
// whatever bank account is on file right now. Unlike Route there is no
// Razorpay-side KYC to wait for — once the fund account exists the seller
// can be paid — so the automation sets this up for every approved seller
// with bank details, and re-does the fund account whenever the bank changes.

const DEFAULT_COOLDOWN_HOURS = 48;

function cooldownMs() {
  const hours = Number(process.env.PAYOUT_BANK_CHANGE_COOLDOWN_HOURS);
  return (Number.isFinite(hours) && hours >= 0 ? hours : DEFAULT_COOLDOWN_HOURS) * 60 * 60 * 1000;
}

function hasBank(vendor) {
  return Boolean(vendor?.bank?.accountNumber && vendor?.bank?.ifsc);
}

/**
 * Can this seller be paid right now? Checked before every payout.
 *
 * @returns {{ ready: boolean, reason?: string }}
 */
function payoutAccountReady(vendor, now = new Date()) {
  if (!vendor) return { ready: false, reason: 'Seller not found' };
  if (vendor.verificationStatus !== 'APPROVED' || !vendor.isActive) {
    return { ready: false, reason: 'Seller is not approved and active' };
  }
  if (!hasBank(vendor)) return { ready: false, reason: 'Seller has no bank account on file' };

  const rx = vendor.razorpayx || {};
  if (!rx.fundAccountId || rx.fundAccountKey !== razorpayx.bankKey(vendor.bank)) {
    return { ready: false, reason: 'Seller bank account is not set up on RazorpayX yet' };
  }
  if (rx.bankChangedAt && now.getTime() - new Date(rx.bankChangedAt).getTime() < cooldownMs()) {
    return { ready: false, reason: 'Seller changed their bank account recently — payouts wait out the cool-off' };
  }
  return { ready: true };
}

/**
 * Create (or re-use) the seller's contact and a fund account for their
 * current bank account. A fund account for an older bank account is
 * deactivated so nothing can ever be paid to it again. Saves onto `vendor`.
 *
 * @returns {Promise<{ ok: boolean, skipped?: boolean, message?: string }>}
 */
async function ensurePayoutAccount(vendorOrId) {
  const vendor = vendorOrId && typeof vendorOrId.save === 'function' ? vendorOrId : await Vendor.findById(vendorOrId);
  if (!vendor) return { ok: false, skipped: true, message: 'Seller not found' };
  if (vendor.verificationStatus !== 'APPROVED') return { ok: false, skipped: true, message: 'Seller is not approved yet' };
  if (!hasBank(vendor)) return { ok: false, skipped: true, message: 'Seller has no bank account on file' };

  vendor.razorpayx = vendor.razorpayx || {};
  const rx = vendor.razorpayx;
  const key = razorpayx.bankKey(vendor.bank);
  if (rx.contactId && rx.fundAccountId && rx.fundAccountKey === key) return { ok: true };

  try {
    if (!rx.contactId) {
      const contact = await razorpayx.createContact({
        name: vendor.business?.businessName || vendor.name,
        email: vendor.email,
        contact: String(vendor.contactPerson?.mobile || vendor.mobile || '').replace(/\D/g, '').slice(-10),
        referenceId: String(vendor._id),
        notes: { vendorId: String(vendor._id) },
      });
      rx.contactId = contact.id;
      await vendor.save();
    }

    const fundAccount = await razorpayx.createBankFundAccount({
      contactId: rx.contactId,
      name: vendor.bank.accountHolderName || vendor.business?.businessName || vendor.name,
      ifsc: vendor.bank.ifsc,
      accountNumber: vendor.bank.accountNumber,
    });

    const previous = rx.fundAccountId;
    rx.fundAccountId = fundAccount.id;
    rx.fundAccountKey = key;
    rx.lastError = '';
    rx.lastSyncedAt = new Date();
    await vendor.save();

    if (previous && previous !== fundAccount.id) {
      try {
        await razorpayx.deactivateFundAccount(previous);
      } catch (err) {
        // The new account is already the only one payouts use (payouts always
        // read vendor.razorpayx.fundAccountId); this is housekeeping.
        console.error(`[vendorPayoutAccount] could not deactivate old fund account ${previous}:`, razorpayx.errorText(err));
      }
    }
    return { ok: true };
  } catch (err) {
    rx.lastError = razorpayx.errorText(err).slice(0, 500);
    rx.lastSyncedAt = new Date();
    await vendor.save();
    return { ok: false, message: rx.lastError };
  }
}

/**
 * Every approved, active seller with bank details whose fund account is
 * missing or out of date with their bank. One at a time.
 */
async function syncPendingPayoutAccounts() {
  const vendors = await Vendor.find({
    verificationStatus: 'APPROVED',
    isActive: true,
    'bank.accountNumber': { $nin: [null, ''] },
    'bank.ifsc': { $nin: [null, ''] },
  });

  const summary = { checked: 0, ready: 0, failed: 0 };
  for (const vendor of vendors) {
    const rx = vendor.razorpayx || {};
    if (rx.fundAccountId && rx.fundAccountKey === razorpayx.bankKey(vendor.bank)) continue;
    summary.checked += 1;
    const result = await ensurePayoutAccount(vendor);
    if (result.ok) summary.ready += 1;
    else if (!result.skipped) summary.failed += 1;
  }
  return summary;
}

/**
 * Tell the admins a seller changed their payout bank account, so an
 * unexpected change (a taken-over seller login) is caught during the
 * cool-off, before any money goes to the new account. Never throws.
 */
function alertBankChanged(vendor) {
  const last4 = String(vendor.bank?.accountNumber || '').replace(/\s+/g, '').slice(-4);
  const hours = Math.round(cooldownMs() / (60 * 60 * 1000));
  alertAdmins({
    event: 'VENDOR_BANK_CHANGED',
    title: 'Seller changed payout bank account',
    message: `${vendor.business?.businessName || vendor.name} changed their payout bank account to one ending ${last4 || '----'}. Automatic payouts to them are paused for ${hours} hours — check this was really them.`,
    link: `/admin/people/sellers/${vendor._id}`,
    key: `VENDOR_BANK_CHANGED:${vendor._id}:${Date.now()}`,
  }).catch(() => {});
}

module.exports = { payoutAccountReady, ensurePayoutAccount, syncPendingPayoutAccounts, alertBankChanged, cooldownMs };
