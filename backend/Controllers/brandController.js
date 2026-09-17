const Brand = require('../Models/Brand');
const { getImageUrl } = require('../utils/imageHelper');
const { PUBLIC_APPROVAL_FILTER } = require('../utils/publicVisibility');

function toBool(value, fallback) {
  if (value === undefined) return fallback;
  return value === true || value === 'true';
}

function serializeBrand(b) {
  return {
    id: b._id.toString(),
    _id: b._id.toString(),
    name: b.name,
    logo: getImageUrl(b.logo),
    isActive: b.isActive !== false,
    createdByVendor: b.createdByVendor ? b.createdByVendor.toString() : null,
    approvalStatus: b.approvalStatus || 'APPROVED',
    rejectionReason: b.rejectionReason || '',
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

async function listBrands(req, res) {
  const brands = await Brand.find().sort({ createdAt: -1 }).lean();
  const items = brands.map(serializeBrand);

  const stats = {
    total: items.length,
    active: items.filter((b) => b.isActive).length,
    inactive: items.filter((b) => !b.isActive).length,
    pending: items.filter((b) => b.approvalStatus === 'PENDING').length,
  };

  res.json({ success: true, data: { items, stats } });
}

async function createBrand(req, res) {
  const { name, isActive } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Brand name is required' });
  }

  const brand = await Brand.create({
    name: name.trim(),
    logo: req.file?.url || null,
    isActive: toBool(isActive, true),
  });

  res.status(201).json({
    success: true,
    message: 'Brand created successfully',
    data: serializeBrand(brand),
  });
}

async function updateBrand(req, res) {
  const { id } = req.params;
  const { name, isActive } = req.body;

  const brand = await Brand.findById(id);
  if (!brand) {
    return res.status(404).json({ success: false, message: 'Brand not found' });
  }

  if (name && name.trim()) {
    brand.name = name.trim();
  }

  if (isActive !== undefined) {
    brand.isActive = toBool(isActive, brand.isActive);
  }

  if (req.file?.url) {
    brand.logo = req.file.url;
  }

  await brand.save();

  res.json({
    success: true,
    message: 'Brand updated successfully',
    data: serializeBrand(brand),
  });
}

async function updateBrandStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: 'isActive is required' });
  }

  const brand = await Brand.findById(id);
  if (!brand) {
    return res.status(404).json({ success: false, message: 'Brand not found' });
  }

  brand.isActive = toBool(isActive, brand.isActive);
  await brand.save();

  res.json({
    success: true,
    message: `Brand ${brand.isActive ? 'activated' : 'deactivated'}`,
    data: serializeBrand(brand),
  });
}

async function decideBrandApproval(req, res) {
  const { id } = req.params;
  const { decision, rejectionReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'Decision must be APPROVED or REJECTED' });
  }

  const brand = await Brand.findById(id);
  if (!brand) {
    return res.status(404).json({ success: false, message: 'Brand not found' });
  }

  brand.approvalStatus = decision;
  brand.rejectionReason = decision === 'REJECTED' ? (rejectionReason || '').trim() : '';
  await brand.save();

  res.json({
    success: true,
    message: `Brand ${decision === 'APPROVED' ? 'approved and live' : 'rejected'}`,
    data: serializeBrand(brand),
  });
}

async function deleteBrand(req, res) {
  const { id } = req.params;

  const brand = await Brand.findById(id);
  if (!brand) {
    return res.status(404).json({ success: false, message: 'Brand not found' });
  }

  await brand.deleteOne();

  res.json({
    success: true,
    message: 'Brand deleted successfully',
    data: { id: brand._id.toString() },
  });
}

async function listPublicBrands(req, res) {
  // Projected: the public list renders a name and a logo, so there is no
  // reason to ship the moderation fields and timestamps that serializeBrand's
  // admin callers need.
  // $nin, not equality — same reason as categories: brands predating the
  // approval workflow have no approvalStatus, and this endpoint was returning
  // an empty list for all 30 brands in the catalog. See utils/publicVisibility.
  const brands = await Brand.find({ isActive: true, approvalStatus: PUBLIC_APPROVAL_FILTER })
    .select('name logo')
    .sort({ name: 1 })
    .lean();

  res.json({
    success: true,
    message: 'Brands fetched successfully',
    data: {
      items: brands.map((brand) => ({
        id: brand._id.toString(),
        name: brand.name,
        logo: brand.logo ? getImageUrl(brand.logo) : null,
      })),
      total: brands.length,
    },
  });
}

module.exports = {
  listBrands,
  listPublicBrands,
  createBrand,
  updateBrand,
  updateBrandStatus,
  decideBrandApproval,
  deleteBrand,
};
