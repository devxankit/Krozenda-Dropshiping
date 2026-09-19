const { parseCjPrice } = require('./cjPricing');

// Backend adapter/normalizer between CJ's raw API shape and everything else
// in Krozenda. Nothing outside this file (and cjInventoryService/
// cjOnboardingService, which read CJ responses directly for their own
// narrower reasons) should ever see a raw CJ product object — the frontend
// never does, and the catalogue/detail controllers always pass their
// response through here first.

// CJ's `productName` is a JSON-encoded array of source-language title
// variants, e.g. '["长标题","短标题1","短标题2"]'. Malformed/absent JSON must
// never crash the request — this is the one place that string is touched.
function parseSourceTitles(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

// Priority: English name -> first parsed source title -> a labelled
// fallback. Never silently shows "undefined" or an empty string as a title.
function resolveTitle(product) {
  if (product.productNameEn && typeof product.productNameEn === 'string') return product.productNameEn;
  const sourceTitles = parseSourceTitles(product.productName);
  if (sourceTitles[0]) return sourceTitles[0];
  return 'Untitled CJ Product';
}

// Search-result / grid-card shape — deliberately narrow. Everything a card
// in the catalogue grid needs and nothing else (no supplierId, sourceFrom,
// customizationVersion, listingCount, raw category ids, createTime, ...).
function normalizeSearchItem(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const externalProductId = raw.pid || raw.productId;
  if (!externalProductId) return null; // never hand the frontend a card it can't act on

  return {
    externalProvider: 'CJ_DROPSHIPPING',
    externalProductId: String(externalProductId),
    externalSku: raw.productSku || '',
    title: resolveTitle(raw),
    primaryImage: typeof raw.productImage === 'string' ? raw.productImage : null,
    sourceCategory: {
      id: raw.categoryId || null,
      name: raw.categoryName || null,
    },
    // CJ's own sale-price quote, parsed defensively (§ range-string bug
    // fixed in cjPricing.parseCjPrice) — this is a SUPPLIER cost estimate
    // for the admin browsing screen, never the customer-facing price.
    sourcePrice: parseCjPrice(raw.sellPrice),
    // CJ's public docs do not state a currency per response field; every
    // account we've observed quotes in USD, which the rest of this CJ
    // integration (cjOrderService, cjPricing) already assumes — kept
    // explicit here rather than silently inferred per-response.
    currency: 'USD',
    isFreeShipping: raw.isFreeShipping === true,
    shippingCountryCodes: Array.isArray(raw.shippingCountryCodes) ? raw.shippingCountryCodes : [],
    // Raw CJ status, kept separate from any Krozenda business status (§26)
    // — nothing here decides DRAFT/ACTIVE/etc from this number.
    sourceStatus: raw.saleStatus ?? null,
    isTestProduct: raw.isTestProduct === true,
  };
}

// Full detail shape — includes everything the admin detail drawer needs,
// still without CJ's supplier-only bookkeeping fields (supplierId,
// customizationJson*, sourceFrom, ...).
function normalizeProductDetail(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const externalProductId = raw.pid;
  if (!externalProductId) return null;

  return {
    externalProvider: 'CJ_DROPSHIPPING',
    externalProductId: String(externalProductId),
    externalSku: raw.productSku || '',
    title: resolveTitle(raw),
    sourceTitles: parseSourceTitles(raw.productName),
    sourceCategory: {
      id: raw.categoryId || null,
      name: raw.categoryName || null,
    },
    productType: raw.productType || null,
    images: Array.isArray(raw.productImageSet) && raw.productImageSet.length > 0
      ? raw.productImageSet
      : raw.productImage
        ? [raw.productImage]
        : [],
    sourcePrice: parseCjPrice(raw.sellPrice),
    currency: 'USD',
    // CJ's productWeight is a plain numeric string ("500.00") with no unit
    // declared anywhere in its API docs — this project does not guess
    // between grams and ounces on its behalf. `unit: null` is honest, not
    // a bug; a future admin-facing "confirm weight unit" step (or a
    // documented CJ confirmation) should fill this in, not a guess here.
    weight: raw.productWeight != null ? { raw: raw.productWeight, unit: null } : null,
    // Raw, unsanitized HTML from CJ — the ONLY place this survives is here,
    // for a caller that explicitly wants it (e.g. a future admin-only raw
    // preview). Every path that reaches an actual UI must go through
    // cjOnboardingService.cleanCjDescription instead.
    descriptionHtmlRaw: typeof raw.description === 'string' ? raw.description : '',
    sourceStatus: raw.status ?? null,
    isTestProduct: raw.isTestProduct === true,
  };
}

// Variant shape — mirrors what cjOnboardingService/cjInventoryService
// already read off a raw CJ variant, exposed here so the admin detail
// drawer gets the same clean shape instead of the raw one.
function normalizeVariant(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const externalVariantId = raw.vid || raw.variantId;
  if (!externalVariantId) return null;

  return {
    externalVariantId: String(externalVariantId),
    externalSku: raw.variantSku || '',
    title: raw.variantNameEn || [raw.variantKey, raw.variantValue].filter(Boolean).join(' / ') || externalVariantId,
    image: raw.variantImage || null,
    sourcePrice: parseCjPrice(raw.variantSellPrice ?? raw.sellPrice),
    currency: 'USD',
    // Deliberately NOT included: stock. CJ's variant-list response never
    // carries it (verified against a live account) — see
    // cjProductService.getVariantTotalStock, a separate, slower call the
    // detail drawer should only make when it actually needs current stock,
    // not on every card render.
  };
}

module.exports = {
  parseSourceTitles,
  resolveTitle,
  normalizeSearchItem,
  normalizeProductDetail,
  normalizeVariant,
};
