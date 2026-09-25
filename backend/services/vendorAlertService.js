// Seller-facing alerts that go out on more than the in-app bell: the in-app
// row + socket + push (createNotification) AND a WhatsApp to the seller's
// registered mobile, because a seller with the panel closed and push denied
// otherwise misses orders and money.
//
// Never throws — every caller is an order, payout or approval flow that must
// not fail because a message did not go out. The WhatsApp itself is detached
// (not awaited), exactly like the order-status messages: the request that
// raised it never waits on the gateway.
const Vendor = require('../Models/Vendor');
const { createNotification } = require('../Controllers/notificationController');
const whatsapp = require('./whatsappService');
const links = require('../utils/notificationLinks');

async function loadVendor(vendorOrId) {
  if (vendorOrId && vendorOrId.mobile !== undefined) return vendorOrId;
  return Vendor.findById(vendorOrId).select('name mobile business notificationPrefs').lean();
}

function sellerName(vendor) {
  return whatsapp.firstName(vendor?.name, 'Seller');
}

/**
 * New order for one or more sellers: one push + one WhatsApp per seller,
 * counting only that seller's lines. Keyed on (order, seller), so a retried
 * checkout never messages a seller twice.
 */
async function notifyVendorsOfNewOrder(order) {
  const items = order.items || [];
  const byVendor = new Map();
  for (const item of items) {
    if (!item.vendor) continue;
    const id = String(item.vendor);
    const entry = byVendor.get(id) || { count: 0, amount: 0 };
    entry.count += Number(item.quantity || 0);
    entry.amount += Number(item.price || 0) * Number(item.quantity || 0);
    byVendor.set(id, entry);
  }

  const orderNumber = whatsapp.orderNumber(order._id);
  await Promise.all(
    [...byVendor.entries()].map(async ([vendorId, { count, amount }]) => {
      try {
        await createNotification({
          vendorId,
          type: 'ORDER',
          title: 'New Order Received',
          message: `You have a new order ${orderNumber} for ${count} item(s) worth ₹${amount.toLocaleString('en-IN')}.`,
          actionType: 'ORDER',
          actionRefId: order._id,
          link: links.vendor.orders(),
        });

        const vendor = await loadVendor(vendorId);
        if (!vendor || vendor.notificationPrefs?.orderUpdates === false) return;
        whatsapp.sendTemplateOnce({
          key: `VENDOR_NEW_ORDER:${order._id}:${vendorId}`,
          template: 'VENDOR_NEW_ORDER',
          phone: vendor.mobile,
          params: [sellerName(vendor), orderNumber, String(count), whatsapp.rupees(amount)],
        });
      } catch (err) {
        console.error(`[vendorAlert] new order ${order._id} for ${vendorId} failed:`, err.message);
      }
    })
  );
}

/**
 * Money reached the seller's bank. `key` must identify the payout/settlement
 * so the manual "mark paid" and the Razorpay Route webhook for the same payout
 * never both message.
 */
async function notifyVendorSettlementPaid({ vendorId, amount, reference = '', key }) {
  try {
    const vendor = await loadVendor(vendorId);
    if (!vendor) return;
    whatsapp.sendTemplateOnce({
      key: `VENDOR_SETTLEMENT:${key}`,
      template: 'VENDOR_SETTLEMENT',
      phone: vendor.mobile,
      params: [sellerName(vendor), whatsapp.rupees(amount), reference || 'see Earnings in your seller panel'],
    });
  } catch (err) {
    console.error('[vendorAlert] settlement WhatsApp failed:', err.message);
  }
}

/**
 * Account approved / rejected: in-app + push + WhatsApp. Keyed on the vendor
 * and the moment of the decision, so a re-review after a rejection is a new
 * message but a double click is not.
 */
async function notifyVendorAccountDecision(vendor, decision, reason = '') {
  try {
    const approved = decision === 'APPROVED';
    const trimmed = String(reason || '').trim();

    await createNotification({
      vendorId: vendor._id,
      type: 'SYSTEM',
      title: approved ? 'Seller Account Approved!' : 'Seller Application Update',
      message: approved
        ? 'Congratulations! Your seller account has been approved by the Admin team. You can now access your dashboard, list products, and start selling on Krozenda.'
        : trimmed
          ? `Your seller application could not be approved: ${trimmed}. Please update your documents and resubmit.`
          : 'Your seller application could not be approved. Please review your documents and resubmit.',
      actionType: 'NONE',
      link: approved ? links.vendor.dashboard() : '/seller/status',
    });

    const decidedAt = new Date(vendor.updatedAt || Date.now()).getTime();
    whatsapp.sendTemplateOnce({
      key: `VENDOR_ACCOUNT:${vendor._id}:${decision}:${decidedAt}`,
      template: 'VENDOR_ACCOUNT',
      phone: vendor.mobile,
      // Params are capped at 60 characters (cleanParam), so the wording lives
      // in the template and only the outcome and the reason travel here.
      params: [
        sellerName(vendor),
        approved ? 'approved' : 'not approved',
        approved ? 'Log in and list your first products' : trimmed || 'Please update your documents and resubmit',
      ],
    });
  } catch (err) {
    console.error('[vendorAlert] account decision failed:', err.message);
  }
}

module.exports = { notifyVendorsOfNewOrder, notifyVendorSettlementPaid, notifyVendorAccountDecision };
