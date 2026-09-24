const mongoose = require('mongoose');
const Coupon = require('../Models/Coupon');
const Customer = require('../Models/Customer');
const couponWhatsapp = require('../services/couponWhatsappService');

// A hand-picked send is answered with its real result; larger than this and
// the admin should use "all customers", which runs in the background.
const MAX_SPECIFIC = 100;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /admin/marketing/coupons/whatsapp/customers?search= — picker for the
// "specific customers" send. Only buyers with a mobile number are useful here.
async function searchCustomers(req, res) {
  const term = String(req.query.search || '').trim();
  const filter = { isDeleted: false, isActive: true, mobileNumber: { $nin: [null, ''] } };
  if (term) {
    const re = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: re }, { email: re }, { mobileNumber: re }];
  }
  const customers = await Customer.find(filter).select('name email mobileNumber').sort({ createdAt: -1 }).limit(20).lean();
  res.json({
    success: true,
    data: {
      items: customers.map((c) => ({
        id: c._id.toString(),
        name: c.name || '',
        email: c.email || '',
        phone: c.mobileNumber || '',
      })),
    },
  });
}

// GET /admin/marketing/coupons/:id/whatsapp — what has gone out so far, and
// whether a send is possible right now.
async function getCouponWhatsapp(req, res) {
  const coupon = await Coupon.findById(req.params.id).lean();
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }
  res.json({
    success: true,
    data: {
      ...(await couponWhatsapp.stats(coupon._id)),
      blockedReason: couponWhatsapp.blockedReason(coupon),
    },
  });
}

// POST /admin/marketing/coupons/:id/whatsapp
// body: { audience: 'all' } or { audience: 'specific', customerIds: [...] }
async function sendCouponWhatsapp(req, res) {
  const { audience } = req.body;
  if (!['all', 'specific'].includes(audience)) {
    return res.status(400).json({ success: false, message: "audience must be 'all' or 'specific'" });
  }

  let customerIds = [];
  if (audience === 'specific') {
    customerIds = [...new Set((Array.isArray(req.body.customerIds) ? req.body.customerIds : []).map(String))].filter(
      (id) => mongoose.isValidObjectId(id)
    );
    if (customerIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one customer' });
    }
    if (customerIds.length > MAX_SPECIFIC) {
      return res.status(400).json({
        success: false,
        message: `Pick up to ${MAX_SPECIFIC} customers, or send to all customers instead`,
      });
    }
  }

  const coupon = await Coupon.findById(req.params.id).lean();
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }
  const blocked = couponWhatsapp.blockedReason(coupon);
  if (blocked) {
    return res.status(400).json({ success: false, message: blocked });
  }

  const { recipients, ineligible, noPhone } = await couponWhatsapp.resolveRecipients(coupon, { audience, customerIds });
  if (recipients.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No eligible customer with a valid mobile number to send this coupon to',
    });
  }

  const sentBy = req.admin?._id || null;
  const summary = { audience, recipients: recipients.length, ineligible, noPhone };

  if (audience === 'specific') {
    const counts = await couponWhatsapp.deliver(coupon, recipients, sentBy);
    return res.json({
      success: true,
      message: `Sent to ${counts.sent} customer${counts.sent === 1 ? '' : 's'}`,
      data: { ...summary, ...counts, queued: false },
    });
  }

  // "All customers" can be thousands of gateway calls; answer now and let
  // GET /:id/whatsapp report progress.
  couponWhatsapp
    .deliver(coupon, recipients, sentBy)
    .then((counts) => console.log(`[couponWhatsapp] ${coupon.code} broadcast done:`, counts))
    .catch((err) => console.error(`[couponWhatsapp] ${coupon.code} broadcast crashed:`, err.message));

  res.status(202).json({
    success: true,
    message: `Sending to ${recipients.length} customer${recipients.length === 1 ? '' : 's'} in the background`,
    data: { ...summary, queued: true },
  });
}

module.exports = { searchCustomers, getCouponWhatsapp, sendCouponWhatsapp };
