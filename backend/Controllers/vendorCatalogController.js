const Category = require('../Models/Category');
const Brand = require('../Models/Brand');
const CatalogSettings = require('../Models/CatalogSettings');
const { getImageUrl } = require('../utils/imageHelper');
const { PUBLIC_APPROVAL_FILTER } = require('../utils/publicVisibility');

function serializeCategory(cat) {
  return {
    id: cat._id.toString(),
    name: cat.name,
    image: getImageUrl(cat.image),
    isActive: cat.isActive !== false,
    approvalStatus: cat.approvalStatus || 'APPROVED',
    rejectionReason: cat.rejectionReason || '',
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
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  const existing = await Category.findOne({ name: name.trim(), approvalStatus: { $ne: 'REJECTED' } });
  if (existing) {
    return res.status(400).json({ success: false, message: `"${name.trim()}" already exists or is pending review` });
  }

  const { autoApprovalEnabled } = await CatalogSettings.getSettings();

  const category = await Category.create({
    name: name.trim(),
    image: req.file?.url || null,
    createdByVendor: req.vendor._id,
    approvalStatus: autoApprovalEnabled ? 'APPROVED' : 'PENDING',
  });

  res.status(201).json({
    success: true,
    message: autoApprovalEnabled ? 'Category created' : 'Category submitted for admin approval',
    data: serializeCategory(category),
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
