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
    version: 'v2.5',
    status: 'published',
    requiresAcceptance: true,
    updatedBy: 'Legal Compliance Division',
    content: `KROZENDA PRIVACY POLICY

Last updated: 17 September 2026
Version: v2.5
Published by: Legal & Compliance Division

This Privacy Policy explains how KroZenda Technologies Private Limited ("KroZenda", "we", "our", "us") collects, uses, stores, processes, and protects your personal and transactional information across our web platform, mobile applications, and connected services.

We operate in compliance with the Digital Personal Data Protection Act, 2023 (DPDP Act), the Information Technology Act, 2000, and the Consumer Protection (E-Commerce) Rules, 2020.


1. INFORMATION WE COLLECT

We collect personal and transactional data necessary to operate your account, process orders, and facilitate pan-India deliveries:

   •  Contact & Identification: Mobile phone number (mandatory primary identifier for OTP verification), full name, email address, and profile photo.
   •  Delivery Addresses: Recipient name, complete shipping address, landmark, city, state, postal PIN code, and contact phone number.
   •  B2B & Vendor Verification Data: Business entity name, GSTIN certificate, PAN card details, warehouse address, and bank account details for settlement disbursements.
   •  Usage & Technical Metrics: IP address, device model, operating system, browser specifications, access timestamps, and device push notification tokens.


2. HOW WE USE YOUR INFORMATION

Your information is processed strictly for legitimate operational purposes:

   •  Account Management: Generating secure session tokens and authenticating sign-ins via dynamic One-Time Passwords (OTPs).
   •  Order Processing: Routing multi-vendor drop-shipping orders, generating automated invoices, and calculating live shipping distances.
   •  Logistics & Fulfillment: Sharing recipient dispatch details with verified courier partners and suppliers for packaging and pan-India delivery.
   •  Customer Care & Dispute Resolution: Managing customer inquiries, tracking order status, and resolving returns, cancellations, or refund claims.
   •  Regulatory & Tax Compliance: Maintaining audited sales records and tax registers in accordance with Indian statutory requirements.


3. PAYMENT PROCESSING & FINANCIAL DATA SECURITY

We treat your payment and financial information with bank-grade security:

   •  Zero Storage of Sensitive Card Credentials: We never receive, process, or store your complete debit/credit card numbers, CVV, expiry dates, net-banking credentials, or UPI PINs.
   •  PCI-DSS Certified Gateway: All online payments are handled directly by Razorpay, a certified PCI-DSS Level 1 payment aggregator.
   •  Encrypted Payment References: KroZenda stores only unique alphanumeric transaction IDs, payment status flags, and masked card identifiers (e.g. card network and last 4 digits) for verification and refund processing.


4. DATA SHARING WITH LOGISTICS & THIRD-PARTY SUPPLIERS

We share only the minimum information required to complete your orders:

   •  Drop-shipping Vendors & Manufacturers: Independent sellers receive only the recipient name, delivery address, contact phone number, and items purchased to pack and dispatch your parcel. Vendors do not receive your email address, billing records, or browsing history.
   •  Logistics Partners: Verified shipping aggregators and courier networks (including Delhivery, Bluedart, Xpressbees, Shadowfax, and Shiprocket) receive shipment delivery coordinates to perform doorstep deliveries and collect COD payments.
   •  Strict No-Sale Policy: We do not sell, rent, monetize, or trade your personal details to third-party data brokers or marketing agencies.


5. KROZENDA WALLET & TRANSACTION INTEGRITY

All financial interactions within the KroZenda internal wallet are safeguarded:

   •  Transaction Records: Every wallet credit, debit, instant refund, or promotional credit is recorded with an immutable timestamp, order reference, and balance ledger.
   •  Fraud Detection: Automated security algorithms monitor wallet usage and multiple account creations to prevent promo abuse and unauthorized transfers.
   •  Non-Transferable Balance: In accordance with RBI guidelines on closed-loop marketplace wallets, wallet balances cannot be transferred to third-party accounts or redeemed for physical currency except where mandated by law.


6. AI ASSISTANT & CONVERSATIONAL PRIVACY

Our integrated AI Assistant provides real-time account insights under strict privacy constraints:

   •  Restricted Account Scope: The AI Assistant can query only records belonging to your currently signed-in session (e.g., active orders, shipping milestones, wallet balance, and recent tickets). It cannot access any other customer's or seller's records.
   •  Data Minimization: Queries sent to our enterprise AI engine (Google Gemini API) contain only the specific question and relevant sanitized order metadata.
   •  Masking of Sensitive Details: Street addresses, payment tokens, and authentication credentials are systematically excluded from AI prompts. Chat histories can be cleared from your account settings at any time.


7. COOKIES, LOCAL STORAGE & PUSH NOTIFICATIONS

We use standard client-side storage technologies transparently:

   •  Essential Session Storage: Browser local storage and session tokens are used exclusively to maintain your active login session, cart contents, and interface preferences.
   •  Push Notification Tokens: Device tokens (Firebase Cloud Messaging) are utilized exclusively to broadcast real-time dispatch updates, delivery alerts, and critical security notices.
   •  No Third-Party Tracking Pixels: We do not use cross-site behavioral tracking cookies or third-party ad profiling trackers. You can disable notifications at any time through your browser or device settings.


8. DATA RETENTION & ARCHIVAL RULES

We retain personal information only as long as necessary to fulfill contractual and legal obligations:

   •  Account Information: Retained for the duration of your active platform membership.
   •  Tax & Accounting Archives: Invoices, order ledgers, payment proofs, and wallet transactions are preserved for up to 8 years as required under Indian GST laws and the Companies Act, 2013.
   •  Customer Support Logs: Support tickets and return inspection records are stored for 3 years to resolve potential disputes or warranty claims.
   •  Account Deletion: When you request account deletion, non-statutory data is permanently removed or irreversibly anonymized within 30 days.


9. SECURITY PROTOCOLS & ENCRYPTION MEASURES

We implement comprehensive technical and organizational safeguards:

   •  Encryption in Transit: All data transferred between your browser or mobile app and our cloud servers is protected using TLS 1.3 encryption (HTTPS).
   •  Encryption at Rest: Sensitive database records and backups are protected using industry-standard 256-bit AES encryption.
   •  Access Controls: Production databases are restricted behind virtual private networks (VPN), strict IP allowlisting, and role-based administrative credentials.
   •  Rate Limiting: Dynamic rate limiting protects login endpoints and OTP requests against automated brute-force attacks.


10. USER RIGHTS, GRIEVANCE REDRESSAL & CONTACT

Under applicable data protection laws, including the DPDP Act, 2023, you retain key rights regarding your personal information:

   •  Right to Access & Correction: You may review, verify, or correct your personal information directly through the profile settings in your KroZenda account.
   •  Right to Consent Withdrawal: You can withdraw consent for promotional communications or push notifications at any time.
   •  Grievance Officer: In accordance with the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000, our designated Grievance and Data Protection Officer can be reached at:

      Grievance & Data Protection Officer
      KroZenda Technologies Private Limited
      Email: compliance@krozenda.com
      Alternative Support: privacy@krozenda.com
      Customer Helpline: +91 1800-KROZENDA
      Response SLA: Acknowledgement within 48 hours; resolution within 30 calendar days.`,
  },
  {
    title: 'Terms & Conditions',
    slug: 'terms',
    version: 'v4.0',
    status: 'published',
    requiresAcceptance: true,
    updatedBy: 'Legal Compliance Division',
    content: `KROZENDA TERMS AND CONDITIONS

Last updated: 17 September 2026
Version: v4.0
Published by: Legal & Compliance Division

These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User", "Customer", "Buyer", or "Drop-shipper") and KroZenda Technologies Private Limited ("KroZenda", "we", "our", or "us"), governing your access to and use of the KroZenda website, mobile application, and related services (collectively, the "Platform").

By registering an account, browsing our catalog, or placing an order, you confirm that you have read, understood, and agreed to these Terms. If you do not accept these Terms in full, please refrain from using the Platform.


1. PLATFORM ROLE & MULTI-VENDOR MARKETPLACE

KroZenda operates an electronic B2B and B2C commerce and drop-shipping ecosystem connecting buyers, resellers, and independent third-party vendors and manufacturers:

   •  Intermediary Function: For products listed by independent suppliers, KroZenda acts as an electronic intermediary under Section 79 of the Information Technology Act, 2000.
   •  Contract of Sale: The commercial contract for the sale of goods is concluded directly between you and the respective seller. The seller is solely responsible for product specifications, manufacturing quality, packaging, and issuing statutory tax invoices.
   •  Direct KroZenda Sales: For select items sold directly by KroZenda, the product listing and tax invoice will explicitly designate KroZenda as the seller.
   •  Platform Services: KroZenda provides catalog display, payment routing, order synchronization, customer assistance, and automated fulfillment tracking.


2. USER ELIGIBILITY & ACCOUNT INTEGRITY

To access our commerce features and place orders, you must satisfy basic eligibility criteria:

   •  Age Competence: You must be at least 18 years of age and legally competent to enter into binding contracts under the Indian Contract Act, 1872. Minors may use the Platform only under parental or legal guardian supervision.
   •  Authentication via OTP: Accounts are created and secured using your registered 10-digit Indian mobile number and dynamic One-Time Passwords (OTPs). You are solely responsible for maintaining the confidentiality of your credentials.
   •  No Credential Sharing: KroZenda representatives will never contact you requesting your OTP, banking passwords, or UPI PIN. Never disclose these credentials to anyone.
   •  Accurate Contact Information: You agree to provide genuine, up-to-date delivery addresses and phone numbers. KroZenda cannot be held liable for failed or delayed shipments resulting from inaccurate user inputs.


3. PRODUCT CATALOG, PRICING & INVENTORY

We maintain rigorous standards for product listings, pricing accuracy, and inventory management:

   •  Currency & Taxes: All wholesale, drop-shipping, and retail prices are quoted in Indian Rupees (INR) and are inclusive of applicable Goods and Services Tax (GST) unless indicated otherwise.
   •  Live Server Price Calculation: Catalog prices and promotional discounts are validated on KroZenda’s secure servers at checkout. Any local cache or device-side display discrepancies will be overridden by live server pricing.
   •  Visual Representations: Product photographs and descriptions are provided by manufacturers and vendors. While we aim for visual fidelity, slight color variations may occur depending on screen displays and photography lighting.
   •  Inventory Synchronization: Listing an item does not constitute a perpetual guarantee of stock availability. If an ordered item is out of stock, KroZenda will cancel the unavailable item and issue an immediate full refund.


4. ORDER CONFIRMATION & CONTRACT FORMATION

Placing an order initiates a formal procurement workflow:

   •  Order Offer: Submitting an order constitutes an offer to purchase the selected items. An order is confirmed and legally binding only when KroZenda issues an Order Confirmation with an assigned Order Reference ID.
   •  Order Rejection or Cancellation: KroZenda or the merchant reserves the right to cancel an order prior to dispatch in cases of stock shortages, obvious pricing errors, delivery unserviceability, or suspected coupon manipulation.
   •  Multi-Vendor Split Dispatches: When an order contains merchandise from multiple independent vendors, items will be packaged and dispatched separately, each carrying its individual courier tracking number.


5. PAYMENT METHODS, WALLET & CASH ON DELIVERY (COD)

We offer versatile, secure payment options to accommodate buyers and drop-shippers:

   •  Online Payments: Supported via Razorpay including UPI, Credit Cards, Debit Cards, and Net Banking. All transactions adhere to stringent RBI security directives.
   •  KroZenda Wallet: Registered users can utilize instant wallet credits resulting from order cancellations, returns, or promotional allowances to make purchases across the Platform.
   •  Cash on Delivery (COD): COD is accessible for eligible delivery pin codes and qualifying basket amounts. Consignees must have exact cash ready upon delivery agent arrival.
   •  COD Fair Usage: Repeated refusal or deliberate non-acceptance of valid COD consignments without justifiable cause may result in permanent suspension of COD payment privileges.


6. PAN-INDIA SHIPPING, LOGISTICS & FULFILLMENT

Logistics are managed through integrated national courier networks covering 26,000+ Indian postal PIN codes:

   •  Integrated Carriers: Shipments are routed through premier logistics partners including Delhivery, Bluedart, Xpressbees, Shadowfax, and Shiprocket.
   •  Delivery Estimates: Estimated transit durations are 2 to 4 business days for Metros, 4 to 7 business days for Tier 2/3 cities, and 7 to 10 business days for remote regions. These timelines are estimates and subject to transit conditions.
   •  Live Tracking: Tracking numbers and carrier names are published to your Orders Dashboard upon parcel pickup by the carrier.
   •  Transfer of Title: Risk and responsibility in the purchased goods transfer to the buyer upon physical delivery and verification at the specified address.


7. CANCELLATION, RETURN, REPLACEMENT & REFUND POLICY

We provide a streamlined dispute redressal and refund framework:

   •  Order Cancellations: You may cancel an order directly from your account dashboard while it is marked "Pending" or "Processing". Once marked "Shipped", orders cannot be cancelled and must be processed as returns.
   •  7-Day Return Window: Return or replacement requests for eligible physical goods may be initiated within 7 calendar days from confirmed delivery.
   •  Condition of Returned Goods: Returned products must be unused, unaltered, unwashed, and accompanied by original packaging, brand tags, warranty cards, and accessories.
   •  Non-Returnable Goods: Customized goods, perishable products, personal hygiene merchandise, and unsealed consumables are non-returnable unless received damaged or defective.
   •  Refund Processing: Approved refunds are credited to your KroZenda Wallet within 24 hours, or refunded to the original payment source within 5 to 7 business days depending on banking clearing cycles.


8. ACCEPTABLE PLATFORM USE & PROHIBITED CONDUCT

Users agree to utilize the Platform strictly for authorized, lawful commercial activities:

   •  No Automated Scraping: You may not use automated spiders, bots, crawlers, or scrapers to extract product catalogs, pricing databases, or customer feedback.
   •  Account Integrity & Promo Abuse: Creating multiple fake accounts, circulating unauthorized voucher codes, or exploiting system errors to obtain unauthorized discounts is strictly prohibited.
   •  System Security: You must not attempt to circumvent authentication protocols, inject malicious code, overload server infrastructures, or probe system vulnerabilities.
   •  Enforcement: KroZenda reserves the right to immediately suspend or terminate accounts found violating these provisions and initiate appropriate legal action under the IT Act, 2000.


9. INTELLECTUAL PROPERTY & PROPRIETARY RIGHTS

All proprietary rights on the Platform are rigorously protected:

   •  KroZenda IP: The KroZenda trademark, logo, design system, source code, workflows, algorithms, and website layouts are the exclusive intellectual property of KroZenda Technologies Private Limited.
   •  Third-Party Trademarks: Merchant brand names, trade dress, product imagery, and logos displayed on listings remain the property of their respective trademark holders.
   •  User-Generated Content: By posting reviews, ratings, or feedback on the Platform, you grant KroZenda an unrestricted, royalty-free, perpetual license to host, display, and publish this content across our digital channels.


10. LIMITATION OF LIABILITY, GOVERNING LAW & GRIEVANCE REDRESSAL

Our liability limits, governing jurisdiction, and grievance redressal mechanisms are defined below:

   •  Liability Limitation: To the maximum extent permitted by applicable law, KroZenda’s aggregate liability for any claim arising from an order or Platform usage shall not exceed the actual amount paid by you for that specific order.
   •  Indirect Damages: KroZenda shall not be liable for indirect, punitive, special, or consequential damages, loss of anticipated business profits, or commercial interruption.
   •  Governing Law & Jurisdiction: These Terms are governed by and construed in accordance with the laws of India. Subject to amicable resolution, the courts of Bengaluru, Karnataka possess exclusive jurisdiction.
   •  Grievance Officer: In adherence with the Consumer Protection (E-Commerce) Rules, 2020:

      Grievance Officer
      KroZenda Technologies Private Limited
      Email: compliance@krozenda.com
      Customer Helpline: +91 1800-KROZENDA
      Complaints will be acknowledged within 48 hours and resolved within one month of formal submission.`,
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
  } else {
    // Auto-upgrade privacy-policy and terms if they contain the legacy short 3-point seed
    for (const seed of DEFAULT_SEED_PAGES) {
      if (['privacy-policy', 'terms'].includes(seed.slug)) {
        const existing = await CmsPage.findOne({ slug: seed.slug, isDeleted: false });
        if (existing && existing.content && existing.content.length < 1500) {
          existing.content = seed.content;
          existing.version = seed.version;
          existing.title = seed.title;
          existing.updatedBy = seed.updatedBy;
          await existing.save();
        }
      }
    }
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
