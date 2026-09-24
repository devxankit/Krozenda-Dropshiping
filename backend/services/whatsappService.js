// WhatsApp order notifications through BhashSMS (bhashsms.com, sender
// BUZWAP). Every message is a Meta-approved template: the gateway takes the
// template NAME in `text` and its {{n}} variables, in order, in `Params`
// (comma-separated). The template wording itself lives on the BhashSMS/Meta
// side, not here — the copy for each event is in docs/WHATSAPP_TEMPLATES.md.
//
// Verified 2026-09-24: a send of the approved `order_update` template over
// HTTPS returned "S.<messageId>". A rejected send also comes back HTTP 200,
// so the body is what decides success.
//
// Nothing in here ever throws to a caller: an order must never fail, or be
// rolled back, because a WhatsApp message could not go out.
const Order = require('../Models/Order');

const API_URL = process.env.WHATSAPP_API_URL || 'https://bhashsms.com/api/sendmsgutil.php';

// One entry per customer-facing event. `params` must match the approved
// template's {{1}}, {{2}}... order exactly. Each event can point at its own
// template via env; any that is not set falls back to WHATSAPP_TEMPLATE_DEFAULT
// (the already-approved `order_update`), which takes the same four params as
// ORDER_PLACED: name, order number, amount, date.
const EVENTS = {
  PLACED: {
    env: 'WHATSAPP_TEMPLATE_ORDER_PLACED',
    params: (o) => [o.name, o.orderNumber, o.amount, o.date],
  },
  PROCESSING: {
    env: 'WHATSAPP_TEMPLATE_ORDER_CONFIRMED',
    params: (o) => [o.name, o.orderNumber, o.amount, o.date],
  },
  SHIPPED: {
    env: 'WHATSAPP_TEMPLATE_ORDER_SHIPPED',
    params: (o) => [o.name, o.orderNumber, o.courier, o.tracking],
  },
  DELIVERED: {
    env: 'WHATSAPP_TEMPLATE_ORDER_DELIVERED',
    params: (o) => [o.name, o.orderNumber, o.amount, o.date],
  },
  CANCELLED: {
    env: 'WHATSAPP_TEMPLATE_ORDER_CANCELLED',
    params: (o) => [o.name, o.orderNumber, o.amount, o.refundNote],
  },
};

function isConfigured() {
  return Boolean(process.env.WHATSAPP_USER && process.env.WHATSAPP_PASS && process.env.WHATSAPP_SENDER);
}

// Tests load the real .env, so they must never reach the gateway; everywhere
// else sending is opt-in through WHATSAPP_ENABLED.
function isEnabled() {
  return process.env.WHATSAPP_ENABLED === 'true' && process.env.ENV !== 'test' && isConfigured();
}

function templateFor(event) {
  const own = EVENTS[event] && process.env[EVENTS[event].env];
  if (own) return { name: own, dedicated: true };
  const fallback = process.env.WHATSAPP_TEMPLATE_DEFAULT;
  return fallback ? { name: fallback, dedicated: false } : null;
}

function orderNumber(orderId) {
  return `ORD-${String(orderId).slice(-8).toUpperCase()}`;
}

function formatDate(value) {
  const d = value ? new Date(value) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

// Params are comma-separated on the wire, so a comma inside a value would
// shift every variable after it. Newlines are rejected by Meta in variables.
function cleanParam(value, fallback = '-') {
  const text = String(value ?? '')
    .replace(/[,\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return (text || fallback).slice(0, 60);
}

// Indian mobile, 10 digits, as the gateway expects it (no country code).
function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

function describe(order, event) {
  const live = (order.items || []).filter((i) => i.status !== 'CANCELLED');
  const shipped = live.find((i) => i.trackingNumber) || (order.items || []).find((i) => i.trackingNumber);
  const firstName = String(order.shippingAddress?.fullName || '').trim().split(/\s+/)[0];
  const amount = Number(order.total || 0);
  const refundable = order.paymentMethod !== 'COD' && ['PAID', 'REFUNDED'].includes(order.paymentStatus) && amount > 0;
  return {
    name: firstName || 'Customer',
    orderNumber: orderNumber(order._id),
    amount: `Rs.${amount.toLocaleString('en-IN')}`,
    date: formatDate(event === 'PLACED' ? order.createdAt : new Date()),
    courier: shipped?.courierName || 'our courier partner',
    tracking: shipped?.trackingNumber || 'shared soon',
    refundNote: refundable
      ? // Dropship orders go back to the original payment (dropshipOrderService);
        // every other cancellation refunds to the wallet (orderCancellationService).
        order.fulfillmentType === 'DROPSHIP'
        ? 'to your original payment method in 5-7 working days'
        : 'credited to your Krozenda wallet'
      : 'not applicable as no payment was taken',
  };
}

async function callGateway({ phone, template, params }) {
  const query = new URLSearchParams({
    user: process.env.WHATSAPP_USER,
    pass: process.env.WHATSAPP_PASS,
    sender: process.env.WHATSAPP_SENDER,
    phone,
    text: template,
    priority: 'wa',
    stype: 'normal',
    Params: params.join(','),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(`${API_URL}?${query.toString()}`, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  const raw = (await response.text()).trim();
  // "S.374146" = accepted with message id 374146. Anything else is an error
  // string from the gateway (bad login, template not approved, no balance).
  if (!response.ok || !/^S\.\S+/.test(raw)) {
    throw new Error(`BhashSMS rejected the message: ${raw || `HTTP ${response.status}`}`);
  }
  return raw.slice(2);
}

/**
 * Send the WhatsApp for one order event. Claims the (order, event) pair on
 * the order first, so a webhook retry, a CJ poll or a double click never
 * sends the same update twice. Never throws.
 */
async function notifyOrderEvent(orderOrId, event) {
  if (!isEnabled() || !EVENTS[event]) return null;
  try {
    const order =
      orderOrId && orderOrId.shippingAddress ? orderOrId : await Order.findById(orderOrId).lean();
    if (!order) return null;

    const template = templateFor(event);
    if (!template) return null;
    // The shared fallback template reads as an order confirmation, so it is
    // only ever used for that — a SHIPPED or CANCELLED update without its own
    // approved template is skipped, not sent wrongly worded.
    if (!template.dedicated && event !== 'PLACED') return null;

    const phone = normalisePhone(order.shippingAddress?.phone);
    if (!phone) {
      console.warn(`[whatsapp] ${event} skipped for ${order._id}: no valid mobile number`);
      return null;
    }

    const claimed = await Order.updateOne(
      { _id: order._id, 'whatsappLog.event': { $ne: event } },
      { $push: { whatsappLog: { event, template: template.name, at: new Date(), status: 'SENDING' } } }
    );
    if (claimed.modifiedCount === 0) return null;

    const info = describe(order, event);
    const params = EVENTS[event].params(info).map((p) => cleanParam(p));

    let result;
    try {
      const messageId = await callGateway({ phone, template: template.name, params });
      result = { status: 'SENT', messageId };
    } catch (err) {
      result = { status: 'FAILED', error: String(err.message).slice(0, 300) };
      console.error(`[whatsapp] ${event} for ${order._id} failed:`, err.message);
    }

    await Order.updateOne(
      { _id: order._id, 'whatsappLog.event': event },
      {
        $set: {
          'whatsappLog.$.status': result.status,
          'whatsappLog.$.messageId': result.messageId || null,
          'whatsappLog.$.error': result.error || null,
        },
      }
    );
    return result;
  } catch (err) {
    console.error(`[whatsapp] ${event} notification crashed:`, err.message);
    return null;
  }
}

/**
 * Send the login/registration OTP over WhatsApp, alongside the SMS. Uses the
 * Meta "Authentication" template named in WHATSAPP_TEMPLATE_OTP, whose only
 * variable is the code. Returns the gateway message id, or null when WhatsApp
 * is off or no OTP template is set. Throws on a rejected send so the caller
 * can tell "delivered" from "not delivered" — unlike order updates, which
 * never throw.
 */
async function sendOtpWhatsApp(mobileNumber, otp) {
  const template = process.env.WHATSAPP_TEMPLATE_OTP;
  if (!isEnabled() || !template) return null;

  const phone = normalisePhone(mobileNumber);
  if (!phone) throw new Error(`Invalid destination number: ${mobileNumber}`);

  const messageId = await callGateway({ phone, template, params: [String(otp)] });
  console.log(`[whatsapp] OTP sent to ${phone}, message ${messageId}`);
  return messageId;
}

module.exports = {
  notifyOrderEvent,
  sendOtpWhatsApp,
  isEnabled,
  isConfigured,
  EVENTS,
  cleanParam,
  normalisePhone,
  orderNumber,
  formatDate,
  // Raw template send, for callers with their own event log (coupon offers).
  // Throws on a rejected send.
  callGateway,
};
