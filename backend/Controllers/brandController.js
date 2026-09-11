const Brand = require('../Models/Brand');
const { getImageUrl } = require('../utils/imageHelper');

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

function serializeBrand(b) {
  return {
    id: b._id.toString(),
    _id: b._id.toString(),
    name: b.name,
    slug: b.slug || slugify(b.name),
    logo: getImageUrl(b.logo),
    website: b.website || '',
    owner: b.owner || 'In-house',
    description: b.description || '',
    status: b.status || 'live',
    productCount: b.productCount || 0,
    submittedAt: b.createdAt ? b.createdAt.toISOString() : new Date().toISOString(),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

async function seedDefaultBrandsIfEmpty() {
  const count = await Brand.countDocuments({ isDeleted: false });
  if (count > 0) return;

  const defaults = [
    {
      name: 'Krozenda Essentials',
      owner: 'In-house',
      website: 'https://krozenda.com',
      description: 'Official verified flagship line of dropshipping bestsellers.',
      status: 'live',
      productCount: 42,
    },
    {
      name: 'Boat Audio',
      owner: 'Imagine Marketing',
      website: 'https://boat-lifestyle.com',
      description: 'Consumer audio lifestyle accessories and true wireless earphones.',
      status: 'live',
      productCount: 18,
    },
    {
      name: 'Prestige Cookware',
      owner: 'TTK Prestige',
      website: 'https://prestige.in',
      description: 'Kitchen appliances, cookware, and pressure systems.',
      status: 'live',
      productCount: 29,
    },
    {
      name: 'Noise Wearables',
      owner: 'Nexxbase',
      website: 'https://gonoise.com',
      description: 'Smart wearables, fit bands, and audio electronics.',
      status: 'live',
      productCount: 15,
    },
    {
      name: 'Philips Personal Care',
      owner: 'Royal Philips',
      website: 'https://philips.co.in',
      description: 'Grooming tools, shavers, and health personal devices.',
      status: 'live',
      productCount: 12,
    },
  ];

  for (const item of defaults) {
    await Brand.create({
      ...item,
      slug: slugify(item.name),
    });
  }
}

async function listBrands(req, res) {
  await seedDefaultBrandsIfEmpty();

  const brands = await Brand.find({ isDeleted: false }).sort({ createdAt: -1 }).lean();
  const items = brands.map(serializeBrand);

  const stats = {
    totalBrands: items.length,
    liveBrands: items.filter((b) => b.status === 'live').length,
    inHouseBrands: items.filter((b) => b.owner.toLowerCase().includes('in-house')).length,
    partnerBrands: items.filter((b) => !b.owner.toLowerCase().includes('in-house')).length,
  };

  res.json({
    success: true,
    data: {
      items,
      stats,
    },
  });
}

async function createBrand(req, res) {
  const { name, website, owner, description, status } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Brand name is required' });
  }

  const brand = await Brand.create({
    name: name.trim(),
    slug: slugify(name),
    logo: req.file?.url || null,
    website: website ? website.trim() : '',
    owner: owner ? owner.trim() : 'In-house',
    description: description ? description.trim() : '',
    status: status || 'live',
    createdBy: req.admin?._id || null,
  });

  res.status(201).json({
    success: true,
    message: 'Brand created successfully',
    data: serializeBrand(brand),
  });
}

async function updateBrand(req, res) {
  const { id } = req.params;
  const { name, website, owner, description, status } = req.body;

  const brand = await Brand.findOne({ _id: id, isDeleted: false });
  if (!brand) {
    return res.status(404).json({ success: false, message: 'Brand not found' });
  }

  if (name) {
    brand.name = name.trim();
    brand.slug = slugify(name);
  }

  if (website !== undefined) {
    brand.website = website ? website.trim() : '';
  }

  if (owner !== undefined) {
    brand.owner = owner ? owner.trim() : 'In-house';
  }

  if (description !== undefined) {
    brand.description = description ? description.trim() : '';
  }

  if (status) {
    brand.status = status;
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
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const brand = await Brand.findOne({ _id: id, isDeleted: false });
  if (!brand) {
    return res.status(404).json({ success: false, message: 'Brand not found' });
  }

  brand.status = status;
  await brand.save();

  res.json({
    success: true,
    message: `Brand status set to ${status}`,
    data: serializeBrand(brand),
  });
}

async function deleteBrand(req, res) {
  const { id } = req.params;

  const brand = await Brand.findOne({ _id: id, isDeleted: false });
  if (!brand) {
    return res.status(404).json({ success: false, message: 'Brand not found' });
  }

  if (brand.productCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete "${brand.name}" because it is linked to ${brand.productCount} active products.`,
    });
  }

  brand.isDeleted = true;
  await brand.save();

  res.json({
    success: true,
    message: 'Brand removed successfully',
    data: { id: brand._id.toString() },
  });
}

module.exports = {
  listBrands,
  createBrand,
  updateBrand,
  updateBrandStatus,
  deleteBrand,
};
