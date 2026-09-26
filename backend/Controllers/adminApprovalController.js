const Category = require('../Models/Category');
const Brand = require('../Models/Brand');
const Product = require('../Models/Product');
const CatalogSettings = require('../Models/CatalogSettings');
const CommissionRule = require('../Models/CommissionRule');
const AccountingConfig = require('../Models/AccountingConfig');
const { createNotification } = require('./notificationController');
const { getFssaiStatus, getFssaiStatusMap, fssaiBlockMessage } = require('../utils/fssai');
const { prepareCommission, setBaseCommission, CommissionInputError } = require('../services/quickCommission');

const FSSAI_CONTEXT = {
  MISSING: 'Food category · FSSAI licence not uploaded',
  PENDING: 'Food category · FSSAI licence awaiting review',
  REJECTED: 'Food category · FSSAI licence rejected',
};

// The common commission auto-approved items fall back to: the base GLOBAL
// rule (undated, priority 0), else the platform default. Sent with the
// settings so the "turn on auto-approval" prompt opens pre-filled.
async function commonCommission() {
  const [rule, config] = await Promise.all([
    CommissionRule.findOne({ scope: 'GLOBAL', isActive: true, startDate: null, endDate: null, priority: 0 })
      .select('type value')
      .lean(),
    AccountingConfig.resolve(),
  ]);
  return {
    commonCommission: rule ? { type: rule.type, value: rule.value } : null,
    defaultCommissionPercent: config.defaultCommissionPercent,
  };
}

async function serializeSettings(settings) {
  return {
    autoApprovalEnabled: settings.autoApprovalEnabled,
    sellerOnlyMode: settings.sellerOnlyMode,
    ...(await commonCommission()),
  };
}

// GET /admin/catalog/approvals/settings — current auto-approval policy.
async function getApprovalSettings(req, res) {
  const settings = await CatalogSettings.getSettings();
  res.json({ success: true, data: await serializeSettings(settings) });
}

// PUT /admin/catalog/approvals/settings — flip the auto-approval and/or
// seller-only switches. autoApprovalEnabled on: sellers' new categories/
// brands/products go live immediately instead of queuing here. Off:
// everything a seller submits waits for a manual decision. sellerOnlyMode
// on: admin's own create endpoints (productController.createProduct etc.)
// start rejecting with 403 — catalog entries can then only originate from
// sellers, with admin limited to approving/rejecting them here.
async function updateApprovalSettings(req, res) {
  const { autoApprovalEnabled, sellerOnlyMode } = req.body;
  if (autoApprovalEnabled === undefined && sellerOnlyMode === undefined) {
    return res.status(400).json({ success: false, message: 'Nothing to update' });
  }
  if (autoApprovalEnabled !== undefined && typeof autoApprovalEnabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'autoApprovalEnabled must be true or false' });
  }
  if (sellerOnlyMode !== undefined && typeof sellerOnlyMode !== 'boolean') {
    return res.status(400).json({ success: false, message: 'sellerOnlyMode must be true or false' });
  }

  // Turning auto-approval on skips the per-item "set commission" prompt, so
  // the admin may set ONE common commission with it (or skip). It is the
  // GLOBAL base rule, and is validated before the switch flips so a bad rate
  // never leaves auto-approval on with the admin thinking it was saved.
  let commission = null;
  if (autoApprovalEnabled === true) {
    try {
      commission = await prepareCommission(req, 'GLOBAL', null);
    } catch (err) {
      if (err instanceof CommissionInputError) {
        return res.status(err.status).json({ success: false, message: err.message });
      }
      throw err;
    }
  }

  const settings = await CatalogSettings.getSettings();
  if (autoApprovalEnabled !== undefined) settings.autoApprovalEnabled = autoApprovalEnabled;
  if (sellerOnlyMode !== undefined) settings.sellerOnlyMode = sellerOnlyMode;
  settings.updatedBy = req.admin?._id || null;
  await settings.save();

  if (commission) {
    await setBaseCommission({
      scope: 'GLOBAL',
      targetId: null,
      input: commission,
      name: 'All sellers — common commission',
      req,
      reason: 'Set while turning on auto-approval',
    });
  }

  res.json({
    success: true,
    message: 'Approval settings updated',
    data: await serializeSettings(settings),
  });
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
    // A seller's CSV preview is not submitted until the seller approves it.
    Product.find({ approvalStatus: 'PENDING', importPreview: { $ne: true } })
      .populate('vendor', 'name business.businessName')
      .populate('category', 'name')
      .lean(),
  ]);

  const vendorLabel = (v) => v?.business?.businessName || v?.name || 'Unknown seller';

  // Food categories stay blocked until the proposing seller's FSSAI licence
  // is approved; admin sees why instead of a bare disabled button.
  const foodVendorIds = categories.filter((c) => c.isFood && c.createdByVendor).map((c) => c.createdByVendor._id);
  const fssaiByVendor = foodVendorIds.length ? await getFssaiStatusMap(foodVendorIds) : new Map();
  const fssaiOf = (c) => (c.isFood && c.createdByVendor ? fssaiByVendor.get(c.createdByVendor._id.toString()) : null);

  const items = [
    ...categories.map((c) => {
      const fssai = fssaiOf(c);
      const blocked = fssai && fssai !== 'APPROVED';
      return {
        id: `category:${c._id}`,
        kind: 'category',
        name: c.name,
        context: blocked ? FSSAI_CONTEXT[fssai] : c.isFood ? 'Food category · FSSAI licence approved' : 'New category proposal',
        submittedBy: vendorLabel(c.createdByVendor),
        submittedAt: c.createdAt,
        waitingDays: daysSince(c.createdAt),
        blockedBy: blocked ? 'FSSAI licence' : null,
      };
    }),
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
  const doc = await Model.findOne({
    _id: parsed.rawId,
    approvalStatus: 'PENDING',
    // Not in the queue until the seller submits it (see listApprovalQueue).
    ...(parsed.kind === 'product' ? { importPreview: { $ne: true } } : {}),
  });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Item not found or already decided' });
  }

  if (decision === 'APPROVED' && parsed.kind === 'category' && doc.isFood && doc.createdByVendor) {
    const { status } = await getFssaiStatus(doc.createdByVendor);
    if (status !== 'APPROVED') {
      return res.status(409).json({ success: false, code: 'FSSAI_NOT_APPROVED', message: fssaiBlockMessage(status) });
    }
  }

  // "Set commission or skip" for a seller's category or product.
  const commissionScope = { category: 'CATEGORY', product: 'PRODUCT' }[parsed.kind];
  let commission = null;
  if (decision === 'APPROVED' && commissionScope) {
    try {
      commission = await prepareCommission(req, commissionScope, doc._id);
    } catch (err) {
      if (err instanceof CommissionInputError) return res.status(err.status).json({ success: false, message: err.message });
      throw err;
    }
  }

  doc.approvalStatus = decision;
  if (decision === 'REJECTED') doc.rejectionReason = (req.body.reason || '').trim();
  if (decision === 'APPROVED' && parsed.kind === 'product') doc.isActive = true;
  await doc.save();

  if (commission) {
    await setBaseCommission({
      scope: commissionScope,
      targetId: doc._id,
      input: commission,
      name: `${doc.name} — commission`,
      req,
      reason: `Set while approving the ${parsed.kind}`,
    });
  }

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

  res.json({ success: true, message: `${parsed.kind} ${decision.toLowerCase()}`, data: { id: req.params.id, kind: parsed.kind, name: doc.name, commission } });
}

const approveQueueItem = (req, res) => decide(req, res, 'APPROVED');
const rejectQueueItem = (req, res) => decide(req, res, 'REJECTED');

module.exports = { listApprovalQueue, approveQueueItem, rejectQueueItem, getApprovalSettings, updateApprovalSettings };
