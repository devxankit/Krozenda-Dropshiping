const Banner = require('../Models/Banner');
const { getImageUrl } = require('../utils/imageHelper');

function serializeBanner(b) {
  return {
    id: b._id.toString(),
    _id: b._id.toString(),
    title: b.title,
    productId: b.productId || null,
    productName: b.productName || '',
    image: b.image ? getImageUrl(b.image) : null,
    placement: b.placement || 'hero',
    subtitle: b.subtitle || '',
    tag: b.tag || '',
    icon: b.icon || 'sparkles',
    theme: b.theme || 'blue',
    ctaPath: b.ctaPath || '',
    status: b.status || 'active',
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

async function listBanners(req, res) {
  const banners = await Banner.find({ isDeleted: false }).sort({ createdAt: -1 }).lean();
  const items = banners.map(serializeBanner);

  const stats = {
    totalBanners: items.length,
    activeBanners: items.filter((b) => b.status === 'active').length,
    inactiveBanners: items.filter((b) => b.status === 'inactive').length,
    linkedToProduct: items.filter((b) => Boolean(b.productId)).length,
  };

  res.json({
    success: true,
    data: { items, stats },
  });
}

async function createBanner(req, res) {
  const { title, productId, productName, status, placement, subtitle, tag, icon, theme, ctaPath } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Banner title is required' });
  }

  const resolvedPlacement = Banner.PLACEMENTS.includes(placement) ? placement : 'hero';

  // Only the hero carousel is a pure image click-through — promo cards and
  // trust-strip tiles render from icon + theme + copy instead.
  if (resolvedPlacement === 'hero' && !req.file?.url) {
    return res.status(400).json({ success: false, message: 'Banner image is required' });
  }

  const banner = await Banner.create({
    title: title.trim(),
    productId: productId || null,
    productName: productName ? productName.trim() : '',
    image: req.file?.url || null,
    placement: resolvedPlacement,
    subtitle: subtitle ? subtitle.trim() : '',
    tag: tag ? tag.trim() : '',
    icon: Banner.ICONS.includes(icon) ? icon : 'sparkles',
    theme: Banner.THEMES.includes(theme) ? theme : 'blue',
    ctaPath: ctaPath ? ctaPath.trim() : '',
    status: status || 'active',
    createdBy: req.admin?._id || null,
  });

  res.status(201).json({
    success: true,
    message: 'Banner created successfully',
    data: serializeBanner(banner),
  });
}

async function updateBanner(req, res) {
  const { id } = req.params;
  const { title, productId, productName, status, placement, subtitle, tag, icon, theme, ctaPath } = req.body;

  const banner = await Banner.findOne({ _id: id, isDeleted: false });
  if (!banner) {
    return res.status(404).json({ success: false, message: 'Banner not found' });
  }

  if (title) {
    banner.title = title.trim();
  }

  if (productId !== undefined) {
    banner.productId = productId || null;
  }

  if (productName !== undefined) {
    banner.productName = productName ? productName.trim() : '';
  }

  if (placement !== undefined && Banner.PLACEMENTS.includes(placement)) {
    banner.placement = placement;
  }

  if (subtitle !== undefined) {
    banner.subtitle = subtitle.trim();
  }

  if (tag !== undefined) {
    banner.tag = tag.trim();
  }

  if (icon !== undefined && Banner.ICONS.includes(icon)) {
    banner.icon = icon;
  }

  if (theme !== undefined && Banner.THEMES.includes(theme)) {
    banner.theme = theme;
  }

  if (ctaPath !== undefined) {
    banner.ctaPath = ctaPath.trim();
  }

  if (status) {
    banner.status = status;
  }

  if (req.file?.url) {
    banner.image = req.file.url;
  }

  if (banner.placement === 'hero' && !banner.image) {
    return res.status(400).json({ success: false, message: 'Banner image is required' });
  }

  await banner.save();

  res.json({
    success: true,
    message: 'Banner updated successfully',
    data: serializeBanner(banner),
  });
}

async function updateBannerStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const banner = await Banner.findOne({ _id: id, isDeleted: false });
  if (!banner) {
    return res.status(404).json({ success: false, message: 'Banner not found' });
  }

  banner.status = status;
  await banner.save();

  res.json({
    success: true,
    message: `Banner status set to ${status}`,
    data: serializeBanner(banner),
  });
}

async function deleteBanner(req, res) {
  const { id } = req.params;

  const banner = await Banner.findOne({ _id: id, isDeleted: false });
  if (!banner) {
    return res.status(404).json({ success: false, message: 'Banner not found' });
  }

  banner.isDeleted = true;
  await banner.save();

  res.json({
    success: true,
    message: 'Banner removed successfully',
    data: { id: banner._id.toString() },
  });
}

async function listPublicBanners(req, res) {
  const { placement } = req.query;
  const query = { isDeleted: false, status: 'active' };
  if (Banner.PLACEMENTS.includes(placement)) {
    query.placement = placement;
  }

  // Bounded: the home page renders at most a handful per placement, and an
  // unbounded banner list is an unbounded number of full-width images on the
  // first paint of the storefront.
  const banners = await Banner.find(query).sort({ createdAt: -1 }).limit(30).lean();
  res.json({
    success: true,
    message: 'Banners fetched successfully',
    data: { items: banners.map(serializeBanner), total: banners.length },
  });
}

module.exports = {
  listBanners,
  listPublicBanners,
  createBanner,
  updateBanner,
  updateBannerStatus,
  deleteBanner,
};
