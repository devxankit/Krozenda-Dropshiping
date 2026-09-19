const Category = require('../Models/Category');
const Product = require('../Models/Product');
const CatalogSettings = require('../Models/CatalogSettings');
const { getImageUrl } = require('../utils/imageHelper');
const { PUBLIC_APPROVAL_FILTER } = require('../utils/publicVisibility');

const SELLER_ONLY_MESSAGE =
  'Seller-only catalog mode is on: new categories can only be submitted by sellers. Review them in the approval queue instead.';

function toBool(value, fallback) {
  if (value === undefined) return fallback;
  return value === true || value === 'true';
}

function serializeCategory(cat) {
  return {
    id: cat._id.toString(),
    _id: cat._id.toString(),
    name: cat.name,
    image: getImageUrl(cat.image),
    isActive: cat.isActive !== false,
    isTopCategory: cat.isTopCategory === true,
    createdByVendor: cat.createdByVendor ? cat.createdByVendor.toString() : null,
    approvalStatus: cat.approvalStatus || 'APPROVED',
    rejectionReason: cat.rejectionReason || '',
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  };
}

// Unauthenticated — used by public-facing pickers (e.g. the vendor
// registration wizard's category dropdown) and the storefront categories
// page, which needs real per-category product counts and deal ranges
// instead of hand-authored copy. Only APPROVED categories are ever public —
// a seller-proposed one stays invisible here until admin approves it.
async function listPublicCategories(req, res) {
  // $nin, not equality: categories created before the approval workflow have no
  // approvalStatus field, and an equality check matched none of them — this
  // endpoint was returning an empty list for a catalog with 12 real categories.
  // See utils/publicVisibility.
  const categories = await Category.find({ isActive: true, approvalStatus: PUBLIC_APPROVAL_FILTER })
    .sort({ isTopCategory: -1, name: 1 })
    .select('name image isTopCategory')
    .lean();

  // approvalStatus is in the match on purpose: without it a category's
  // "1,240 Products" badge counted products still awaiting approval (and
  // rejected ones), so the count on the card never matched the number of
  // products the listing page then showed.
  const productStats = await Product.aggregate([
    { $match: { isActive: true, approvalStatus: PUBLIC_APPROVAL_FILTER } },
    {
      $group: {
        _id: '$category',
        productCount: { $sum: 1 },
        maxDiscountPercent: { $max: '$discountPercent' },
      },
    },
  ]);
  const statsByCategory = new Map(productStats.map((stat) => [stat._id.toString(), stat]));

  const items = categories.map((cat) => {
    const stat = statsByCategory.get(cat._id.toString());
    return {
      ...serializeCategory(cat),
      productCount: stat?.productCount || 0,
      maxDiscountPercent: stat?.maxDiscountPercent || 0,
    };
  });

  res.json({ success: true, data: { items } });
}

async function listCategories(req, res) {
  const categories = await Category.find().sort({ createdAt: -1 }).lean();
  const items = categories.map(serializeCategory);

  const stats = {
    total: items.length,
    active: items.filter((c) => c.isActive).length,
    inactive: items.filter((c) => !c.isActive).length,
    top: items.filter((c) => c.isTopCategory).length,
    pending: items.filter((c) => c.approvalStatus === 'PENDING').length,
  };

  res.json({ success: true, data: { items, stats } });
}

async function createCategory(req, res) {
  const settings = await CatalogSettings.getSettings();
  if (settings.sellerOnlyMode) {
    return res.status(403).json({ success: false, message: SELLER_ONLY_MESSAGE });
  }

  const { name, isActive, isTopCategory } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  const category = await Category.create({
    name: name.trim(),
    image: req.file?.url || null,
    isActive: toBool(isActive, true),
    isTopCategory: toBool(isTopCategory, false),
  });

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: serializeCategory(category),
  });
}

async function updateCategory(req, res) {
  const { id } = req.params;
  const { name, isActive, isTopCategory } = req.body;

  const category = await Category.findById(id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  if (name && name.trim()) {
    category.name = name.trim();
  }

  if (isActive !== undefined) {
    category.isActive = toBool(isActive, category.isActive);
  }

  if (isTopCategory !== undefined) {
    category.isTopCategory = toBool(isTopCategory, category.isTopCategory);
  }

  if (req.file?.url) {
    category.image = req.file.url;
  }

  await category.save();

  res.json({
    success: true,
    message: 'Category updated successfully',
    data: serializeCategory(category),
  });
}

async function updateCategoryStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: 'isActive is required' });
  }

  const category = await Category.findById(id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  category.isActive = toBool(isActive, category.isActive);
  await category.save();

  res.json({
    success: true,
    message: `Category ${category.isActive ? 'activated' : 'deactivated'}`,
    data: serializeCategory(category),
  });
}

async function updateCategoryTopStatus(req, res) {
  const { id } = req.params;
  const { isTopCategory } = req.body;

  const category = await Category.findById(id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  category.isTopCategory =
    isTopCategory !== undefined ? toBool(isTopCategory, false) : !category.isTopCategory;
  await category.save();

  res.json({
    success: true,
    message: `Category ${category.isTopCategory ? 'marked as top category' : 'removed from top categories'}`,
    data: serializeCategory(category),
  });
}

// PATCH /admin/catalog/categories/:id/approval — admin decides on a
// seller-proposed category (see Category.createdByVendor). Approving makes
// it immediately usable on the storefront and by every seller; rejecting
// keeps it hidden with a reason the seller can see.
async function decideCategoryApproval(req, res) {
  const { id } = req.params;
  const { decision, rejectionReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'Decision must be APPROVED or REJECTED' });
  }

  const category = await Category.findById(id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  category.approvalStatus = decision;
  category.rejectionReason = decision === 'REJECTED' ? (rejectionReason || '').trim() : '';
  await category.save();

  res.json({
    success: true,
    message: `Category ${decision === 'APPROVED' ? 'approved and live' : 'rejected'}`,
    data: serializeCategory(category),
  });
}

async function deleteCategory(req, res) {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  await category.deleteOne();

  res.json({
    success: true,
    message: 'Category deleted successfully',
    data: { id: category._id.toString() },
  });
}

module.exports = {
  listCategories,
  listPublicCategories,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  updateCategoryTopStatus,
  decideCategoryApproval,
  deleteCategory,
};
