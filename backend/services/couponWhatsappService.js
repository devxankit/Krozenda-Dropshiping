// Coupon offers over WhatsApp (BhashSMS), sent from the admin Coupons screen
// to every eligible customer or to hand-picked ones. Uses the Meta-approved
// Marketing template named in WHATSAPP_TEMPLATE_COUPON — its wording and the
// {{n}} order are in docs/WHATSAPP_TEMPLATES.md (`coupon_offer`).
//
// Every (coupon, customer) pair is claimed in CouponWhatsappLog before the
// send, so pressing "Send to all" twice never messages anyone twice; only a
// FAILED send (or one stuck mid-send after a restart) is tried again.
const Coupon = require('../Models/Coupon');
const Customer = require('../Models/Customer');
const Order = require('../Models/Order');
const CouponWhatsappLog = require('../Models/CouponWhatsappLog');
const whatsapp = require('./whatsappService');

const TEMPLATE_ENV = 'WHATSAPP_TEMPLATE_COUPON';
const CONCURRENCY = 5;
// A SENDING row older than this belongs to a run that died (restart, crash).
const STALE_SENDING_MS = 10 * 60 * 1000;
const SENDABLE_STATUSES = ['ACTIVE', 'UPCOMING'];

function template() {
  return process.env[TEMPLATE_ENV] || '';
}

// Why a coupon cannot go out right now, or null when it can.
function blockedReason(coupon) {
  if (!whatsapp.isEnabled()) return 'WhatsApp sending is off (WHATSAPP_ENABLED / BhashSMS credentials)';
  if (!template()) return `No approved coupon template set (${TEMPLATE_ENV})`;
  const status = Coupon.resolveStatus(coupon);
  if (!SENDABLE_STATUSES.includes(status)) {
    return `This coupon is ${status.toLowerCase().replace(/_/g, ' ')} — only active or upcoming coupons can be sent`;
  }
  return null;
}

function rupees(amount) {
  return `Rs.${Number(amount || 0).toLocaleString('en-IN')}`;
}

// Params for `coupon_offer`, in {{n}} order:
// name · code · offer · minimum order · valid till
function couponParams(coupon, customer) {
  const firstName = String(customer.name || '').trim().split(/\s+/)[0];
  let offer =
    coupon.discountType === 'PERCENTAGE'
      ? `${coupon.discountValue}% off${coupon.maxDiscountAmount != null ? ` (up to ${rupees(coupon.maxDiscountAmount)})` : ''}`
      : `${rupees(coupon.discountValue)} off`;
  if (coupon.applicableTo !== 'ALL') offer += ' on selected items';

  return [
    firstName || 'there',
    coupon.code,
    offer,
    coupon.minOrderAmount > 0 ? rupees(coupon.minOrderAmount) : 'no minimum',
    whatsapp.formatDate(coupon.endDate),
  ].map((p) => whatsapp.cleanParam(p));
}

// Narrows candidate customers to the ones the coupon will actually accept at
// checkout, so nobody is sent a code that then says "not for your account".
async function filterEligible(coupon, customers) {
  if (coupon.customerEligibility === 'SPECIFIC') {
    const allowed = new Set((coupon.customerIds || []).map(String));
    return customers.filter((c) => allowed.has(String(c._id)));
  }
  if (coupon.customerEligibility === 'NEW' || coupon.customerEligibility === 'EXISTING') {
    // Same rule as applyCoupon: any order not cancelled makes a returning customer.
    const buyers = await Order.distinct('user', {
      user: { $in: customers.map((c) => c._id) },
      status: { $ne: 'CANCELLED' },
    });
    const returning = new Set(buyers.map(String));
    const wantReturning = coupon.customerEligibility === 'EXISTING';
    return customers.filter((c) => returning.has(String(c._id)) === wantReturning);
  }
  return customers;
}

/**
 * Works out who a send would reach. audience 'all' = every active customer
 * the coupon is valid for; 'specific' = the given customerIds, minus any the
 * coupon would reject. Customers without a valid Indian mobile are counted
 * separately, never sent.
 */
async function resolveRecipients(coupon, { audience, customerIds = [] }) {
  const filter = { isDeleted: false, isActive: true };
  if (audience === 'specific') filter._id = { $in: customerIds };
  else if (coupon.customerEligibility === 'SPECIFIC') filter._id = { $in: coupon.customerIds || [] };

  const candidates = await Customer.find(filter).select('name mobileNumber').lean();
  const eligible = await filterEligible(coupon, candidates);

  const recipients = [];
  let noPhone = 0;
  for (const c of eligible) {
    const phone = whatsapp.normalisePhone(c.mobileNumber);
    if (phone) recipients.push({ ...c, phone });
    else noPhone += 1;
  }
  return {
    recipients,
    ineligible: (audience === 'specific' ? customerIds.length : candidates.length) - eligible.length,
    noPhone,
  };
}

// Claims the pair, or returns null when it is already sent / being sent.
async function claim(coupon, customer, sentBy) {
  try {
    return await CouponWhatsappLog.findOneAndUpdate(
      {
        couponId: coupon._id,
        customerId: customer._id,
        $or: [{ status: 'FAILED' }, { status: 'SENDING', updatedAt: { $lt: new Date(Date.now() - STALE_SENDING_MS) } }],
      },
      {
        $set: { status: 'SENDING', phone: customer.phone, template: template(), sentBy, error: null, messageId: null },
      },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (err) {
    // Duplicate key = a SENT (or live SENDING) row already exists.
    if (err.code === 11000) return null;
    throw err;
  }
}

async function sendOne(coupon, customer, sentBy) {
  const row = await claim(coupon, customer, sentBy);
  if (!row) return 'SKIPPED';
  try {
    const messageId = await whatsapp.callGateway({
      phone: customer.phone,
      template: template(),
      params: couponParams(coupon, customer),
    });
    await CouponWhatsappLog.updateOne({ _id: row._id }, { $set: { status: 'SENT', messageId } });
    return 'SENT';
  } catch (err) {
    await CouponWhatsappLog.updateOne(
      { _id: row._id },
      { $set: { status: 'FAILED', error: String(err.message).slice(0, 300) } }
    );
    console.error(`[couponWhatsapp] ${coupon.code} to ${customer._id} failed:`, err.message);
    return 'FAILED';
  }
}

/** Sends to every recipient, a few at a time. Never throws per recipient. */
async function deliver(coupon, recipients, sentBy) {
  const counts = { sent: 0, failed: 0, alreadySent: 0 };
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const results = await Promise.all(recipients.slice(i, i + CONCURRENCY).map((c) => sendOne(coupon, c, sentBy)));
    for (const r of results) {
      if (r === 'SENT') counts.sent += 1;
      else if (r === 'FAILED') counts.failed += 1;
      else counts.alreadySent += 1;
    }
  }
  return counts;
}

async function stats(couponId) {
  const rows = await CouponWhatsappLog.aggregate([
    { $match: { couponId } },
    { $group: { _id: '$status', count: { $sum: 1 }, lastAt: { $max: '$updatedAt' } } },
  ]);
  const out = { sent: 0, failed: 0, sending: 0, lastSentAt: null };
  for (const r of rows) {
    out[r._id.toLowerCase()] = r.count;
    if (!out.lastSentAt || r.lastAt > out.lastSentAt) out.lastSentAt = r.lastAt;
  }
  return out;
}

module.exports = {
  TEMPLATE_ENV,
  blockedReason,
  couponParams,
  resolveRecipients,
  deliver,
  stats,
};
