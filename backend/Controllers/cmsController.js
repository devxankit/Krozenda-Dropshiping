const CmsPage = require('../Models/CmsPage');

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function serializeCmsPage(p) {
  return {
    id: p._id.toString(),
    _id: p._id.toString(),
    title: p.title,
    slug: p.slug,
    content: p.content || '',
    version: p.version || 'v1.0',
    status: p.status || 'published',
    requiresAcceptance: Boolean(p.requiresAcceptance),
    metaTitle: p.metaTitle || '',
    metaDescription: p.metaDescription || '',
    updatedBy: p.updatedBy || 'Admin',
    updatedAt: formatDate(p.updatedAt),
    rawUpdatedAt: p.updatedAt,
    createdAt: formatDate(p.createdAt),
  };
}

const DEFAULT_SEED_PAGES = [
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    version: 'v1.4',
    status: 'published',
    requiresAcceptance: true,
    updatedBy: 'Priya Sharma',
    content: `# Privacy Policy for KroZenda Marketplace

Welcome to KroZenda. We take your privacy seriously and understand the importance of safeguarding your personal and transactional information.

### 1. Information We Collect
- **Identity Information**: Name, business name, GSTIN, PAN, and contact details.
- **Transactional Data**: Orders placed, settlement details, delivery addresses, and payment references.
- **Device & Usage**: IP address, login timestamps, and device identifiers.

### 2. How We Use Your Information
We use your information to facilitate drop-shipping operations, automate order fulfillment with Shiprocket, execute split settlements via Razorpay Route, and provide customer support.

### 3. Data Protection & Security
All sensitive customer credentials and OTP logs are encrypted using enterprise-grade 256-bit AES encryption. We do not sell or monetize personal data to third parties.

For inquiries, contact compliance@krozenda.com.`,
  },
  {
    title: 'Terms & Conditions',
    slug: 'terms',
    version: 'v3.0',
    status: 'published',
    requiresAcceptance: true,
    updatedBy: 'Priya Sharma',
    content: `# KroZenda Terms of Service & Commerce Agreement

These Terms and Conditions govern your access to and use of the KroZenda B2B & B2C marketplace platform.

### 1. Platform Role
KroZenda provides an enterprise multi-vendor commerce and drop-shipping ecosystem connecting certified manufacturers, suppliers, resellers, and direct buyers across India.

### 2. Account Registration & KYC
Users agree to provide true, accurate, and current mobile verification and KYC documentation. KroZenda reserves the right to suspend non-compliant seller accounts.

### 3. Orders & Pricing
All product wholesale prices and supplier margins are quoted in Indian Rupees (INR). Sellers agree to maintain live inventory synchronisation to avoid stock-outs.`,
  },
  {
    title: 'Vendor Agreement',
    slug: 'vendor-agreement',
    version: 'v2.1',
    status: 'published',
    requiresAcceptance: true,
    updatedBy: 'Priya Sharma',
    content: `# Master Vendor & Supplier Agreement

This agreement establishes the terms under which suppliers list products and fulfill drop-shipping orders through KroZenda.

### 1. Fulfillment SLA
Sellers must dispatch confirmed orders within 24 hours of order receipt. Failure to meet dispatch SLAs will impact vendor performance ratings and settlement schedules.

### 2. Commission & Margins
Platform commissions are automatically deducted prior to net bank transfers via Razorpay Route.

### 3. Quality & Authenticity Guarantee
Vendors warrant that all merchandise supplied is 100% authentic, brand new, and strictly meets Indian regulatory standards.`,
  },
  {
    title: 'Return Policy',
    slug: 'return-policy',
    version: 'v1.3',
    status: 'published',
    requiresAcceptance: true,
    updatedBy: 'Deepa Raghunathan',
    content: `# Returns & Replacement Guidelines

### 1. Window for Returns
Customers may initiate return requests within 7 calendar days of delivery for eligible physical goods.

### 2. Return-to-Origin (RTO) Processing
In the event of failed COD deliveries, courier partners will execute reverse logistics according to the defined vendor RTO rule.

### 3. Inspection & Refunds
Approved refunds will be processed back to the original payment source within 3-5 business days upon warehouse receipt.`,
  },
  {
    title: 'Shipping Policy',
    slug: 'shipping-policy',
    version: 'v1.1',
    status: 'published',
    requiresAcceptance: true,
    updatedBy: 'Deepa Raghunathan',
    content: `# Pan-India Shipping & Logistics Policy

### 1. Pincode Coverage
KroZenda serves 26,000+ Indian pincodes through integrated multi-courier logistics partners including Delhivery, Bluedart, Xpressbees, and Shadowfax.

### 2. Delivery Timelines
- Metro locations: 2 to 4 business days
- Tier 2 & 3 cities: 4 to 7 business days
- Remote & North-East regions: 7 to 10 business days

Live GPS tracking is accessible on the orders portal immediately following pickup.`,
  },
  {
    title: 'About Krozenda',
    slug: 'about',
    version: 'v1.0',
    status: 'published',
    requiresAcceptance: false,
    updatedBy: 'Priya Sharma',
    content: `# About KroZenda

KroZenda is India's leading unified B2B & B2C drop-shipping and wholesale marketplace. 

Our mission is to empower 100,000+ retailers, entrepreneurs, and independent brands by providing zero-upfront inventory costs, direct factory wholesale pricing, and automated pan-India logistics fulfillment.`,
  },
  {
    title: 'Seller FAQ',
    slug: 'seller-faq',
    version: 'v0.3',
    status: 'draft',
    requiresAcceptance: false,
    updatedBy: 'Deepa Raghunathan',
    content: `# Seller Frequently Asked Questions

### Q1: How quickly do I receive payment settlements?
Settlement batches are calculated and transferred on a T+2 day rolling cycle via automated Razorpay Route transfers.

### Q2: What are the packaging requirements?
All orders must be packaged in plain boxes or official KroZenda branded tamper-proof polybags without external vendor invoices.`,
  },
  {
    title: 'COD Policy',
    slug: 'cod-policy',
    version: 'v1.0',
    status: 'archived',
    requiresAcceptance: false,
    updatedBy: 'Priya Sharma',
    content: `# Cash on Delivery (COD) Operating Policy

This archived policy specifies the guidelines previously enforced for cash collections and reconciliation.`,
  },
];

async function seedIfEmpty() {
  const count = await CmsPage.countDocuments({ isDeleted: false });
  if (count === 0) {
    await CmsPage.insertMany(DEFAULT_SEED_PAGES);
  }
}

// GET /admin/marketing/cms
async function listCmsPages(req, res) {
  await seedIfEmpty();

  const { search, tab, status } = req.query;
  const filter = { isDeleted: false };

  const activeTab = tab || status;
  if (activeTab === 'published') {
    filter.status = 'published';
  } else if (activeTab === 'draft') {
    filter.status = 'draft';
  } else if (activeTab === 'archived') {
    filter.status = 'archived';
  } else if (activeTab === 'legal') {
    filter.requiresAcceptance = true;
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ title: regex }, { slug: regex }, { content: regex }];
  }

  const pages = await CmsPage.find(filter).sort({ updatedAt: -1 }).lean();
  const items = pages.map(serializeCmsPage);

  // Get total counts across all categories for KPI metrics
  const allPages = await CmsPage.find({ isDeleted: false }).lean();
  const stats = {
    totalPages: allPages.length,
    publishedPages: allPages.filter((p) => p.status === 'published').length,
    draftPages: allPages.filter((p) => p.status === 'draft').length,
    archivedPages: allPages.filter((p) => p.status === 'archived').length,
    requiresAcceptance: allPages.filter((p) => p.requiresAcceptance).length,
  };

  res.json({
    success: true,
    data: { items, stats },
  });
}

// GET /admin/marketing/cms/:idOrSlug
async function getCmsPage(req, res) {
  const { idOrSlug } = req.params;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);

  const query = isObjectId
    ? { _id: idOrSlug, isDeleted: false }
    : { slug: idOrSlug.toLowerCase(), isDeleted: false };

  const page = await CmsPage.findOne(query);
  if (!page) {
    return res.status(404).json({ success: false, message: 'CMS page not found' });
  }

  res.json({
    success: true,
    data: serializeCmsPage(page),
  });
}

// POST /admin/marketing/cms
async function createCmsPage(req, res) {
  const { title, slug, content, version, status, requiresAcceptance, metaTitle, metaDescription } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Page title is required' });
  }

  const generatedSlug = slugify(slug || title);
  if (!generatedSlug) {
    return res.status(400).json({ success: false, message: 'Valid slug or title is required' });
  }

  const existing = await CmsPage.findOne({ slug: generatedSlug, isDeleted: false });
  if (existing) {
    return res.status(400).json({ success: false, message: `A page with slug "/${generatedSlug}" already exists` });
  }

  const page = await CmsPage.create({
    title: title.trim(),
    slug: generatedSlug,
    content: content || '',
    version: version?.trim() || 'v1.0',
    status: status || 'published',
    requiresAcceptance: Boolean(requiresAcceptance),
    metaTitle: metaTitle?.trim() || '',
    metaDescription: metaDescription?.trim() || '',
    updatedBy: req.admin?.name || 'Admin',
    createdBy: req.admin?._id || null,
  });

  res.status(201).json({
    success: true,
    message: 'CMS page published live successfully',
    data: serializeCmsPage(page),
  });
}

// PUT /admin/marketing/cms/:id
async function updateCmsPage(req, res) {
  const { id } = req.params;
  const { title, slug, content, version, status, requiresAcceptance, metaTitle, metaDescription } = req.body;

  const page = await CmsPage.findOne({ _id: id, isDeleted: false });
  if (!page) {
    return res.status(404).json({ success: false, message: 'CMS page not found' });
  }

  if (title) {
    page.title = title.trim();
  }

  if (slug) {
    const cleanSlug = slugify(slug);
    if (cleanSlug !== page.slug) {
      const duplicate = await CmsPage.findOne({ slug: cleanSlug, _id: { $ne: page._id }, isDeleted: false });
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Slug "/${cleanSlug}" is already in use` });
      }
      page.slug = cleanSlug;
    }
  }

  if (content !== undefined) {
    page.content = content;
  }

  if (version !== undefined) {
    page.version = version.trim();
  }

  if (status) {
    page.status = status;
  }

  if (requiresAcceptance !== undefined) {
    page.requiresAcceptance = Boolean(requiresAcceptance);
  }

  if (metaTitle !== undefined) {
    page.metaTitle = metaTitle.trim();
  }

  if (metaDescription !== undefined) {
    page.metaDescription = metaDescription.trim();
  }

  page.updatedBy = req.admin?.name || 'Admin';
  await page.save();

  res.json({
    success: true,
    message: 'CMS page updated successfully',
    data: serializeCmsPage(page),
  });
}

// PATCH /admin/marketing/cms/:id/status
async function updateCmsPageStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!['draft', 'published', 'archived'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Choose draft, published, or archived' });
  }

  const page = await CmsPage.findOne({ _id: id, isDeleted: false });
  if (!page) {
    return res.status(404).json({ success: false, message: 'CMS page not found' });
  }

  page.status = status;
  page.updatedBy = req.admin?.name || 'Admin';
  await page.save();

  res.json({
    success: true,
    message: `Page status updated to ${status}`,
    data: serializeCmsPage(page),
  });
}

// DELETE /admin/marketing/cms/:id
async function deleteCmsPage(req, res) {
  const { id } = req.params;

  const page = await CmsPage.findOne({ _id: id, isDeleted: false });
  if (!page) {
    return res.status(404).json({ success: false, message: 'CMS page not found' });
  }

  page.isDeleted = true;
  await page.save();

  res.json({
    success: true,
    message: 'CMS page deleted successfully',
    data: { id: page._id.toString() },
  });
}

// Public endpoint: GET /public/cms/:slug
async function getPublicCmsPage(req, res) {
  await seedIfEmpty();
  const { slug } = req.params;

  const page = await CmsPage.findOne({
    slug: slug.toLowerCase(),
    status: 'published',
    isDeleted: false,
  });

  if (!page) {
    return res.status(404).json({ success: false, message: 'Page not found' });
  }

  res.json({
    success: true,
    data: serializeCmsPage(page),
  });
}

module.exports = {
  listCmsPages,
  getCmsPage,
  createCmsPage,
  updateCmsPage,
  updateCmsPageStatus,
  deleteCmsPage,
  getPublicCmsPage,
};
