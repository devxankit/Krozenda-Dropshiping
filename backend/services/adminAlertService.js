// Operational alerts for the Krozenda team: things that need a human now
// (a CJ order that failed after payment, a refund that did not go through, a
// seller payout that bounced, captured money with no order) and things worth
// knowing about as they happen (a new seller application, a return request, a
// high-value order).
//
// Three channels, all best-effort:
//   1. Socket emit to the `admin` room — an open admin panel shows a toast.
//   2. FCM push to every active admin's registered devices (User.fcmTokens,
//      registered by the admin panel after sign-in).
//   3. WhatsApp to ADMIN_ALERT_WHATSAPP_NUMBERS, only for `urgent` alerts and
//      only once the WHATSAPP_TEMPLATE_ADMIN_ALERT template is approved.
//
// Never throws: an alert failing must never fail the order, refund or
// webhook that raised it.
const User = require('../Models/User');
const NotificationDispatch = require('../Models/NotificationDispatch');
const { sendToTokens } = require('../utils/pushHelper');
const { notifyAdmins } = require('../utils/realtime');
const whatsapp = require('./whatsappService');

function adminWhatsappNumbers() {
  return String(process.env.ADMIN_ALERT_WHATSAPP_NUMBERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
}

function highValueThreshold() {
  const value = Number(process.env.ADMIN_HIGH_VALUE_ORDER_AMOUNT);
  return Number.isFinite(value) && value > 0 ? value : 10000;
}

async function pushToAdmins({ id, title, message, link, event }) {
  const admins = await User.find({
    role: 'admin',
    isActive: true,
    isDeleted: { $ne: true },
    'fcmTokens.0': { $exists: true },
  })
    .select('fcmTokens')
    .lean();
  const tokens = [...new Set(admins.flatMap((a) => (a.fcmTokens || []).map((t) => t.token)).filter(Boolean))];
  if (!tokens.length) return null;

  const result = await sendToTokens(tokens, {
    title,
    body: message,
    // Same id as the socket emit, so an open panel that receives both shows
    // one toast, not two.
    data: { type: 'ADMIN_ALERT', event, audience: 'admin', alertId: id },
    link,
  });
  if (result.staleTokens.length) {
    await User.updateMany({}, { $pull: { fcmTokens: { token: { $in: result.staleTokens } } } });
  }
  return result;
}

/**
 * @param {object} alert
 * @param {string} alert.event    machine name, e.g. CJ_ORDER_FAILED
 * @param {string} alert.title
 * @param {string} alert.message
 * @param {string} [alert.link]   admin panel path to open
 * @param {string} [alert.key]    idempotency key — the same key alerts once
 * @param {boolean} [alert.urgent] also WhatsApp the admin numbers
 */
async function alertAdmins({ event, title, message, link = null, key = null, urgent = false }) {
  try {
    if (key && !(await NotificationDispatch.claim(`ADMIN:${key}`, { event, channel: 'MULTI' }))) {
      return null;
    }

    const id = key || `${event}:${Date.now()}`;
    notifyAdmins({ id, event, title, message, link, createdAt: new Date() });

    let push = null;
    try {
      push = await pushToAdmins({ id, title, message, link, event });
    } catch (err) {
      console.error(`[adminAlert] push for ${event} failed:`, err.message);
    }

    // Detached: the order, refund or webhook that raised the alert never
    // waits on the WhatsApp gateway. sendTemplateOnce never rejects.
    if (urgent) {
      for (const phone of adminWhatsappNumbers()) {
        whatsapp.sendTemplateOnce({
          key: `ADMIN_WA:${id}:${phone}`,
          template: 'ADMIN_ALERT',
          phone,
          // The whole alert, not the first 60 characters of it. Meta caps
          // the full body at 1024, so title + details stay well under that
          // alongside the template's own ~50 characters.
          params: [String(title).slice(0, 100), String(message).slice(0, 800)],
          maxLength: 800,
        });
      }
    }

    if (key) await NotificationDispatch.finish(`ADMIN:${key}`, { status: 'SENT' });
    return push;
  } catch (err) {
    console.error(`[adminAlert] ${event} failed:`, err.message);
    return null;
  }
}

module.exports = { alertAdmins, highValueThreshold, adminWhatsappNumbers };
