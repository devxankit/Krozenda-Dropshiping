const User = require('../Models/User');
const Customer = require('../Models/Customer');
const Vendor = require('../Models/Vendor');
const NotificationCampaign = require('../Models/NotificationCampaign');
const { sendToTokens } = require('../utils/pushHelper');

const AUDIENCE_LABELS = {
  customers: 'All customers',
  sellers: 'All sellers',
  both: 'All customers & sellers',
};

function serializeCampaign(c) {
  return {
    id: c._id.toString(),
    name: c.title,
    channel: 'push',
    audience: AUDIENCE_LABELS[c.audience] || c.audience,
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

async function tokensForAudience(audience) {
  const wantsCustomers = audience === 'customers' || audience === 'both';
  const wantsSellers = audience === 'sellers' || audience === 'both';

  const [customers, sellers] = await Promise.all([
    wantsCustomers
      ? Customer.find({ isDeleted: false, fcmTokens: { $exists: true, $ne: [] } }).select('fcmTokens')
      : [],
    wantsSellers
      ? Vendor.find({ isActive: true, fcmTokens: { $ne: [] } }).select('fcmTokens')
      : [],
  ]);

  const tokens = new Set();
  customers.forEach((doc) => doc.fcmTokens.forEach((t) => tokens.add(t.token)));
  sellers.forEach((doc) => doc.fcmTokens.forEach((t) => tokens.add(t.token)));

  return Array.from(tokens);
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
  const { title, message, audience } = req.body;

  if (!title?.trim() || !message?.trim()) {
    return res.status(400).json({ success: false, message: 'Title and message are required' });
  }
  if (!NotificationCampaign.AUDIENCES.includes(audience)) {
    return res.status(400).json({ success: false, message: 'audience must be customers, sellers or both' });
  }

  const tokens = await tokensForAudience(audience);
  const { successCount, failureCount, staleTokens } = await sendToTokens(tokens, {
    title: title.trim(),
    body: message.trim(),
    data: { type: 'admin_campaign' },
  });

  await pruneStaleTokens(staleTokens);

  const campaign = await NotificationCampaign.create({
    title: title.trim(),
    message: message.trim(),
    audience,
    createdBy: req.admin?._id || null,
    audienceSize: tokens.length,
    delivered: successCount,
    failed: failureCount,
    status: tokens.length && successCount === 0 ? 'failed' : 'sent',
    sentAt: new Date(),
  });

  res.status(201).json({ success: true, message: 'Campaign sent', data: serializeCampaign(campaign) });
}

module.exports = { listCampaigns, sendCampaign };
