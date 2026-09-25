const User = require('../Models/User');
const Customer = require('../Models/Customer');
const Vendor = require('../Models/Vendor');
const NotificationCampaign = require('../Models/NotificationCampaign');
const { sendToTokens } = require('../utils/pushHelper');
const { createNotification } = require('./notificationController');

const AUDIENCE_LABELS = {
  customers: 'All customers',
  sellers: 'All sellers',
  both: 'All customers & sellers',
  specific_seller: 'Specific seller',
};

function serializeCampaign(c) {
  let audienceLabel = AUDIENCE_LABELS[c.audience] || c.audience;
  if (c.audience === 'specific_seller' && c.targetVendorName) {
    audienceLabel = `Seller: ${c.targetVendorName}`;
  }
  return {
    id: c._id.toString(),
    name: c.title,
    channel: 'push',
    audience: audienceLabel,
    audienceSize: c.audienceSize,
    sentAt: c.sentAt ? new Date(c.sentAt).toISOString() : null,
    status: c.status,
    delivered: c.delivered,
    opened: 0, // FCM does not report opens.
  };
}

// GET /admin/marketing/campaigns
async function listCampaigns(req, res) {
  const { tab = 'all', page = 1, rowsPerPage = 25, search = '' } = req.query;

  const filter = {};
  if (tab === 'sent' || tab === 'failed') {
    filter.status = tab;
  } else if (tab === 'scheduled' || tab === 'draft') {
    // Sends here are always immediate — no scheduling/draft state exists yet,
    // so these tabs are legitimately always empty rather than falling back
    // to showing everything.
    filter._id = null;
  }
  if (search) filter.title = { $regex: search, $options: 'i' };

  const pageNum = Math.max(1, Number(page) || 1);
  const limit = Math.max(1, Number(rowsPerPage) || 25);

  const [items, totalItems, sentCount, failedCount] = await Promise.all([
    NotificationCampaign.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limit)
      .limit(limit),
    NotificationCampaign.countDocuments(filter),
    NotificationCampaign.countDocuments({ status: 'sent' }),
    NotificationCampaign.countDocuments({ status: 'failed' }),
  ]);
  const allCount = await NotificationCampaign.countDocuments({});

  res.json({
    success: true,
    data: {
      items: items.map(serializeCampaign),
      page: pageNum,
      rowsPerPage: limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      tabCounts: { all: allCount, sent: sentCount, scheduled: 0, draft: 0, failed: failedCount },
    },
  });
}

// Customers only. Sellers are reached one by one through createNotification
// (see sendCampaign), which also writes their in-app row and applies their
// notification preferences.
async function customerTokens() {
  const customers = await Customer.find({ isDeleted: false, fcmTokens: { $exists: true, $ne: [] } }).select('fcmTokens');
  const tokens = new Set();
  customers.forEach((doc) => doc.fcmTokens.forEach((t) => tokens.add(t.token)));
  return { tokens: Array.from(tokens), recipients: customers.length };
}

async function pruneStaleTokens(staleTokens) {
  if (!staleTokens.length) return;
  await Promise.all([
    User.updateMany({}, { $pull: { fcmTokens: { token: { $in: staleTokens } } } }),
    Customer.updateMany({}, { $pull: { fcmTokens: { token: { $in: staleTokens } } } }),
    Vendor.updateMany({}, { $pull: { fcmTokens: { token: { $in: staleTokens } } } }),
  ]);
}

// POST /admin/marketing/campaigns
async function sendCampaign(req, res) {
  const { title, message, audience, targetVendorId } = req.body;

  if (!title?.trim() || !message?.trim()) {
    return res.status(400).json({ success: false, message: 'Title and message are required' });
  }
  if (!NotificationCampaign.AUDIENCES.includes(audience)) {
    return res.status(400).json({ success: false, message: 'audience must be customers, sellers, both, or specific_seller' });
  }

  let targetVendorName = '';
  let targetVendor = null;
  let sellerIds = [];

  if (audience === 'specific_seller') {
    if (!targetVendorId) {
      return res.status(400).json({ success: false, message: 'Please select a specific seller to send the notification' });
    }
    targetVendor = await Vendor.findById(targetVendorId);
    if (!targetVendor) {
      return res.status(404).json({ success: false, message: 'Selected seller not found' });
    }
    targetVendorName = targetVendor.business?.businessName || targetVendor.name;
    sellerIds = [targetVendor._id];
  } else if (audience === 'sellers' || audience === 'both') {
    sellerIds = (await Vendor.find({ isActive: true }).select('_id').lean()).map((v) => v._id);
  }

  const cleanTitle = title.trim();
  const cleanMessage = message.trim();

  // Sellers: in-app row + socket + push each, through the shared path. A
  // broadcast is marketing (OFFER) and respects the seller's "promotions"
  // switch; a message to one chosen seller is direct (SYSTEM) and always
  // pushed. The in-app row is written either way, so every seller counts as
  // delivered.
  const sellerType = audience === 'specific_seller' ? 'SYSTEM' : 'OFFER';
  for (const vendorId of sellerIds) {
    // eslint-disable-next-line no-await-in-loop
    await createNotification({
      vendorId,
      type: sellerType,
      title: cleanTitle,
      message: cleanMessage,
      actionType: 'NONE',
      link: '/seller/notifications',
    });
  }

  // Customers: one batched push, as before (no in-app row for broadcasts).
  let customerRecipients = 0;
  let pushed = { successCount: 0, failureCount: 0, staleTokens: [] };
  if (audience === 'customers' || audience === 'both') {
    const { tokens, recipients } = await customerTokens();
    customerRecipients = recipients;
    pushed = await sendToTokens(tokens, {
      title: cleanTitle,
      body: cleanMessage,
      data: { type: 'admin_campaign' },
      link: '/app/dashboard',
    });
    await pruneStaleTokens(pushed.staleTokens);
  }

  const campaign = await NotificationCampaign.create({
    title: cleanTitle,
    message: cleanMessage,
    audience,
    targetVendor: targetVendor ? targetVendor._id : null,
    targetVendorName,
    createdBy: req.admin?._id || null,
    audienceSize: sellerIds.length + customerRecipients,
    delivered: sellerIds.length + pushed.successCount,
    failed: pushed.failureCount,
    status: 'sent',
    sentAt: new Date(),
  });

  res.status(201).json({ success: true, message: 'Notification sent successfully', data: serializeCampaign(campaign) });
}

module.exports = { listCampaigns, sendCampaign };
