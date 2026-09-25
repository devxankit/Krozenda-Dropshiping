const Category = require('../Models/Category');
const Brand = require('../Models/Brand');
const CatalogSettings = require('../Models/CatalogSettings');
const { getImageUrl } = require('../utils/imageHelper');
const { PUBLIC_APPROVAL_FILTER } = require('../utils/publicVisibility');
const { looksLikeFood, getFssaiStatus } = require('../utils/fssai');
const { createNotification } = require('./notificationController');

function serializeCategory(cat) {
  return {
    id: cat._id.toString(),
    name: cat.name,
    image: getImageUrl(cat.image),
    isActive: cat.isActive !== false,
    approvalStatus: cat.approvalStatus || 'APPROVED',
    rejectionReason: cat.rejectionReason || '',
    isFood: cat.isFood === true,
    mine: Boolean(cat.createdByVendor),
    createdAt: cat.createdAt,
  };
}

function serializeBrand(b) {
  return {
    id: b._id.toString(),
    name: b.name,
    logo: getImageUrl(b.logo),
    isActive: b.isActive !== false,
    approvalStatus: b.approvalStatus || 'APPROVED',
    rejectionReason: b.rejectionReason || '',
    mine: Boolean(b.createdByVendor),
    createdAt: b.createdAt,
  };
}

// A seller can propose a new category/brand, but it only becomes usable
// platform-wide (storefront + every other seller's product form) once an
// admin approves it — see Category/Brand.approvalStatus and
// categoryController/brandController.decide*Approval. Meanwhile the
// proposing seller can still see their own pending/rejected entries here so
// they know what happened to their request.
async function listMyCategories(req, res) {
  const categories = await Category.find({
    isActive: true,
    $or: [{ approvalStatus: PUBLIC_APPROVAL_FILTER }, { createdByVendor: req.vendor._id }],
  })
    .sort({ isTopCategory: -1, name: 1 })
    .lean();

  res.json({ success: true, data: { items: categories.map(serializeCategory) } });
}

async function createMyCategory(req, res) {
  const { name, isFood } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  const existing = await Category.findOne({ name: name.trim(), approvalStatus: { $ne: 'REJECTED' } });
  if (existing) {
    return res.status(400).json({ success: false, message: `"${name.trim()}" already exists or is pending review` });
  }

  const { autoApprovalEnabled } = await CatalogSettings.getSettings();

  // A food category never auto-approves on a seller whose FSSAI licence
  // isn't approved yet — it waits in the queue, blocked, until it is.
  const food = isFood === true || isFood === 'true' || looksLikeFood(name);
  const fssaiStatus = food ? (await getFssaiStatus(req.vendor._id)).status : null;
  const fssaiBlocked = food && fssaiStatus !== 'APPROVED';

  const category = await Category.create({
    name: name.trim(),
    image: req.file?.url || null,
    createdByVendor: req.vendor._id,
    isFood: food,
    approvalStatus: autoApprovalEnabled && !fssaiBlocked ? 'APPROVED' : 'PENDING',
  });

  const fssaiMessage =
    fssaiStatus === 'PENDING'
      ? `"${category.name}" is a food category. It will be reviewed once admin approves your FSSAI licence.`
      : `"${category.name}" is a food category and you have not added a valid FSSAI licence. Upload it from Store Profile — the category can only be approved after your licence is approved.`;

  if (fssaiBlocked) {
    await createNotification({
      vendorId: req.vendor._id,
      type: 'SYSTEM',
      title: 'FSSAI licence required',
      message: fssaiMessage,
      actionType: 'NONE',
    });
  }

  res.status(201).json({
    success: true,
    message: fssaiBlocked
      ? fssaiMessage
      : category.approvalStatus === 'APPROVED'
        ? 'Category created'
        : 'Category submitted for admin approval',
    data: { ...serializeCategory(category), fssaiRequired: fssaiBlocked, fssaiStatus },
  });
}

async function listMyBrands(req, res) {
  const brands = await Brand.find({
    isActive: true,
    $or: [{ approvalStatus: PUBLIC_APPROVAL_FILTER }, { createdByVendor: req.vendor._id }],
  })
    .sort({ name: 1 })
    .lean();

  res.json({ success: true, data: { items: brands.map(serializeBrand) } });
}

async function createMyBrand(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Brand name is required' });
  }

  const existing = await Brand.findOne({ name: name.trim(), approvalStatus: { $ne: 'REJECTED' } });
  if (existing) {
    return res.status(400).json({ success: false, message: `"${name.trim()}" already exists or is pending review` });
  }

  const { autoApprovalEnabled } = await CatalogSettings.getSettings();

  const brand = await Brand.create({
    name: name.trim(),
    logo: req.file?.url || null,
    createdByVendor: req.vendor._id,
    approvalStatus: autoApprovalEnabled ? 'APPROVED' : 'PENDING',
  });

  res.status(201).json({
    success: true,
    message: autoApprovalEnabled ? 'Brand created' : 'Brand submitted for admin approval',
    data: serializeBrand(brand),
  });
}

module.exports = { listMyCategories, createMyCategory, listMyBrands, createMyBrand };
