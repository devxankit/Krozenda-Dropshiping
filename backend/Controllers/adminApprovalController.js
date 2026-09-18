const Category = require('../Models/Category');
const Brand = require('../Models/Brand');
const Product = require('../Models/Product');
const CatalogSettings = require('../Models/CatalogSettings');
const { createNotification } = require('./notificationController');

// GET /admin/catalog/approvals/settings — current auto-approval policy.
async function getApprovalSettings(req, res) {
  const settings = await CatalogSettings.getSettings();
  res.json({ success: true, data: { autoApprovalEnabled: settings.autoApprovalEnabled } });
}

// PUT /admin/catalog/approvals/settings — flip the auto-approval switch.
// On: sellers' new categories/brands/products go live immediately instead of
// queuing here. Off: everything a seller submits waits for a manual decision.
async function updateApprovalSettings(req, res) {
  const { autoApprovalEnabled } = req.body;
  if (typeof autoApprovalEnabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'autoApprovalEnabled must be true or false' });
  }

  const settings = await CatalogSettings.getSettings();
  settings.autoApprovalEnabled = autoApprovalEnabled;
  settings.updatedBy = req.admin?._id || null;
  await settings.save();

  res.json({ success: true, message: 'Approval settings updated', data: { autoApprovalEnabled: settings.autoApprovalEnabled } });
}

// Unified admin approval queue across the three things a seller can propose:
// categories, brands and products (see Category/Brand.createdByVendor and
// Product.approvalStatus). Only PENDING entries ever show up here —
// admin-created ones default straight to APPROVED and never enter this
// queue. Each item's id is prefixed with its kind ("category:<id>") since
// the three collections' ObjectIds aren't otherwise disambiguated.
function daysSince(date) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)));
}

async function listApprovalQueue(req, res) {
  const [categories, brands, products] = await Promise.all([
    Category.find({ approvalStatus: 'PENDING' }).populate('createdByVendor', 'name business.businessName').lean(),
    Brand.find({ approvalStatus: 'PENDING' }).populate('createdByVendor', 'name business.businessName').lean(),
    Product.find({ approvalStatus: 'PENDING' })
      .populate('vendor', 'name business.businessName')
      .populate('category', 'name')
      .lean(),
  ]);

  const vendorLabel = (v) => v?.business?.businessName || v?.name || 'Unknown seller';

  const items = [
    ...categories.map((c) => ({
      id: `category:${c._id}`,
      kind: 'category',
      name: c.name,
      context: 'New category proposal',
      submittedBy: vendorLabel(c.createdByVendor),
      submittedAt: c.createdAt,
      waitingDays: daysSince(c.createdAt),
      blockedBy: null,
    })),
    ...brands.map((b) => ({
      id: `brand:${b._id}`,
      kind: 'brand',
      name: b.name,
      context: 'New brand proposal',
      submittedBy: vendorLabel(b.createdByVendor),
      submittedAt: b.createdAt,
      waitingDays: daysSince(b.createdAt),
      blockedBy: null,
    })),
    ...products.map((p) => ({
      id: `product:${p._id}`,
      kind: 'product',
      name: p.name,
      context: p.category?.name ? `Category: ${p.category.name}` : 'New product listing',
      submittedBy: vendorLabel(p.vendor),
      submittedAt: p.createdAt,
      waitingDays: daysSince(p.createdAt),
      blockedBy: null,
    })),
  ].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  const tabCounts = {
    all: items.length,
    category: categories.length,
    brand: brands.length,
    product: products.length,
  };

  res.json({ success: true, data: { items, tabCounts } });
}

function parseQueueId(id) {
  const [kind, rawId] = String(id).split(':');
  if (!['category', 'brand', 'product'].includes(kind) || !rawId) return null;
  return { kind, rawId };
}

const MODEL_BY_KIND = { category: Category, brand: Brand, product: Product };
const VENDOR_FIELD_BY_KIND = { category: 'createdByVendor', brand: 'createdByVendor', product: 'vendor' };

async function decide(req, res, decision) {
  const parsed = parseQueueId(req.params.id);
  if (!parsed) {
    return res.status(400).json({ success: false, message: 'Invalid approval queue id' });
  }

  const Model = MODEL_BY_KIND[parsed.kind];
  const doc = await Model.findOne({ _id: parsed.rawId, approvalStatus: 'PENDING' });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Item not found or already decided' });
  }

  doc.approvalStatus = decision;
  if (decision === 'REJECTED') doc.rejectionReason = (req.body.reason || '').trim();
  if (decision === 'APPROVED' && parsed.kind === 'product') doc.isActive = true;
  await doc.save();

  const vendorId = doc[VENDOR_FIELD_BY_KIND[parsed.kind]];
  if (vendorId) {
    await createNotification({
      vendorId,
      type: 'SYSTEM',
      title: decision === 'APPROVED' ? `${parsed.kind[0].toUpperCase()}${parsed.kind.slice(1)} approved` : `${parsed.kind[0].toUpperCase()}${parsed.kind.slice(1)} rejected`,
      message:
        decision === 'APPROVED'
          ? `Your ${parsed.kind} "${doc.name}" is now approved and live.`
          : `Your ${parsed.kind} "${doc.name}" was rejected.${req.body.reason ? ` Reason: ${req.body.reason}` : ''}`,
      actionType: 'NONE',
    });
  }

  res.json({ success: true, message: `${parsed.kind} ${decision.toLowerCase()}`, data: { id: req.params.id, kind: parsed.kind, name: doc.name } });
}

const approveQueueItem = (req, res) => decide(req, res, 'APPROVED');
const rejectQueueItem = (req, res) => decide(req, res, 'REJECTED');

module.exports = { listApprovalQueue, approveQueueItem, rejectQueueItem, getApprovalSettings, updateApprovalSettings };
