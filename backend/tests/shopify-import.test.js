const crypto = require('crypto');

process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY =
  process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const Product = require('../Models/Product');
const importService = require('../services/shopify/shopifyImportService');
const imageService = require('../services/shopify/shopifyImageService');
const { connectTestDb, disconnectTestDb, createCategory, createProduct } = require('./helpers');

const {
  sellingPrice,
  variantLabel,
  availableQuantity,
  weightKgOf,
  isDefaultVariant,
  findSkuCollisions,
} = importService;

beforeAll(async () => {
  await connectTestDb();
});
afterAll(async () => {
  await disconnectTestDb();
});

// ---------------------------------------------------------------------------
describe('pricing', () => {
  test('MIRROR keeps the provider price untouched', () => {
    expect(sellingPrice('599.00', { pricingMode: 'MIRROR' })).toBe(599);
    expect(sellingPrice('3999.00', { pricingMode: 'MIRROR' })).toBe(3999);
    // The default is MIRROR: an unset mode must never silently mark prices up.
    expect(sellingPrice('599.00', {})).toBe(599);
  });

  test('MARKUP applies percent and flat, with rounding', () => {
    expect(sellingPrice(100, { pricingMode: 'MARKUP', markupType: 'PERCENT', markupValue: 30 })).toBe(130);
    expect(sellingPrice(100, { pricingMode: 'MARKUP', markupType: 'FLAT', markupValue: 55 })).toBe(155);
    expect(
      sellingPrice(100, { pricingMode: 'MARKUP', markupType: 'PERCENT', markupValue: 30, priceRounding: 'NINE_ENDING' })
    ).toBe(129);
  });

  // Regression: the obvious 9-ending formula (floor(v/10)*10+9) only ever
  // rounds UP, by as much as 9 — so a 30% markup silently bills as 39%.
  test('9-ending rounding snaps to the nearest, never only upward', () => {
    const nine = (v) => sellingPrice(v, { pricingMode: 'MARKUP', markupType: 'FLAT', markupValue: 0, priceRounding: 'NINE_ENDING' });
    expect(nine(130)).toBe(129); // down 1, not up 9
    expect(nine(135)).toBe(139); // up 4, genuinely nearer
    expect(nine(139)).toBe(139); // already there
    expect(nine(100)).toBe(99);
    expect(nine(5)).toBe(5); // below 10, left alone
  });

  test('a price of zero stays zero rather than becoming a markup of nothing', () => {
    expect(sellingPrice(0, { pricingMode: 'MARKUP', markupType: 'PERCENT', markupValue: 30 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('variant shaping', () => {
  test("Shopify's \"Default Title\" is recognised as a simple product, not an option", () => {
    const product = { variants: { nodes: [{ title: 'Default Title' }] } };
    expect(isDefaultVariant({ title: 'Default Title' }, product)).toBe(true);
    expect(isDefaultVariant({ title: 'default' }, product)).toBe(true);

    // Two variants means the titles are real, even if one is called Default.
    const multi = { variants: { nodes: [{ title: 'Default Title' }, { title: 'Red' }] } };
    expect(isDefaultVariant({ title: 'Default Title' }, multi)).toBe(false);
  });

  test('a label is built from the chosen options, ignoring Default Title', () => {
    expect(
      variantLabel({
        title: 'Red / L',
        selectedOptions: [
          { name: 'Colour', value: 'Red' },
          { name: 'Size', value: 'L' },
        ],
      })
    ).toBe('Red / L');

    expect(variantLabel({ title: 'Default Title', selectedOptions: [{ name: 'Title', value: 'Default Title' }] })).toBe(
      'Default Title'
    );
    expect(variantLabel({ title: '', selectedOptions: [] })).toBe('Standard');
  });

  // The per-location figure is what can actually be shipped; the product-level
  // total can be the sum across locations none of which holds enough.
  test('stock prefers the location-level available quantity', () => {
    const variant = {
      inventoryQuantity: 99,
      inventoryItem: {
        inventoryLevels: { nodes: [{ quantities: [{ name: 'available', quantity: 7 }] }] },
      },
    };
    expect(availableQuantity(variant)).toBe(7);
  });

  test('stock falls back to inventoryQuantity, and never goes negative', () => {
    expect(availableQuantity({ inventoryQuantity: 12 })).toBe(12);
    // Shopify reports oversold stock as a negative; a negative would fail
    // Product's `min: 0` and abort the whole import.
    expect(availableQuantity({ inventoryQuantity: -5 })).toBe(0);
    expect(availableQuantity({})).toBe(0);
  });

  test('weight is normalised to kilograms whatever unit Shopify used', () => {
    expect(weightKgOf({ inventoryItem: { measurement: { weight: { value: 500, unit: 'GRAMS' } } } })).toBe(0.5);
    expect(weightKgOf({ inventoryItem: { measurement: { weight: { value: 2, unit: 'KILOGRAMS' } } } })).toBe(2);
    expect(weightKgOf({ inventoryItem: { measurement: { weight: { value: 1, unit: 'POUNDS' } } } })).toBe(0.45);
    expect(weightKgOf({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Several dropshipping apps feed one Shopify store, and Krozenda reads the
// store rather than the apps. Without this, a stuck order or a margin figure
// can only be attributed to "Shopify", which nobody can act on.
describe('supplier detection', () => {
  const { resolveSupplier } = require('../services/shopify/supplierResolver')
  const product = (skus, vendor = '') => ({ variants: { nodes: skus.map((sku) => ({ sku })) }, vendor })

  test('the SKU prefix identifies the app that listed the product', () => {
    expect(resolveSupplier(product(['VFPD17245-VT0']))).toMatchObject({ code: 'VFULFILL', confidence: 'SKU' })
    expect(resolveSupplier(product(['DS107956']))).toMatchObject({ code: 'DROPSHIP_INDIA', confidence: 'SKU' })
  })

  // Verified against the live store: vFulfill writes the shop's own name and
  // Dropship India writes bare numeric supplier ids, so neither is usable.
  test('vendor is not trusted, because neither app writes its own name there', () => {
    expect(resolveSupplier(product([''], 'My Store')).code).toBe('UNKNOWN')
    expect(resolveSupplier(product([''], '18052')).code).toBe('UNKNOWN')
  })

  test('one blank SKU does not make the whole product unattributable', () => {
    expect(resolveSupplier(product(['', '', 'DS99'])).code).toBe('DROPSHIP_INDIA')
  })

  test('an unrecognised product is UNKNOWN, not guessed at', () => {
    // Guessing would attribute one app's costs and failures to another.
    expect(resolveSupplier(product(['ACME-1']))).toMatchObject({ code: 'UNKNOWN', confidence: 'NONE' })
    expect(resolveSupplier(product([]))).toMatchObject({ code: 'UNKNOWN' })
    expect(resolveSupplier({})).toMatchObject({ code: 'UNKNOWN' })
  })

  test('a longer prefix wins over a shorter one that also matches', () => {
    // 'DS' would otherwise swallow anything starting with those letters.
    expect(resolveSupplier(product(['DSI-500'])).code).toBe('DROPSHIP_INDIA')
  })
})

// ---------------------------------------------------------------------------
describe('SKU collisions', () => {
  test('an existing Krozenda SKU is reported before anything is written', async () => {
    const category = await createCategory();
    await createProduct({ category: category._id, sku: 'VF-CLASH-1', name: 'Existing product' });

    const clashes = await findSkuCollisions(['VF-CLASH-1', 'VF-FREE-1']);
    expect(clashes).toHaveLength(1);
    expect(clashes[0].sku).toBe('VF-CLASH-1');
    expect(clashes[0].name).toBe('Existing product');
  });

  test('no collision for unused SKUs, and an empty list is cheap', async () => {
    expect(await findSkuCollisions(['NOTHING-USES-THIS'])).toHaveLength(0);
    expect(await findSkuCollisions([])).toHaveLength(0);
    expect(await findSkuCollisions([null, undefined, ''])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The image downloader takes a URL from an external API, so it is a
// server-side request forgery risk unless every hop is checked.
describe('image download safety', () => {
  test('only Shopify CDN hosts are allowed', () => {
    expect(imageService.hostAllowed('cdn.shopify.com')).toBe(true);
    expect(imageService.hostAllowed('foo.cdn.shopify.com')).toBe(true);

    // The classic bypass: an allowed host as a PREFIX of an attacker's domain.
    expect(imageService.hostAllowed('cdn.shopify.com.evil.tld')).toBe(false);
    expect(imageService.hostAllowed('evil.tld')).toBe(false);
    expect(imageService.hostAllowed('localhost')).toBe(false);
    expect(imageService.hostAllowed('')).toBe(false);
  });

  test('private and loopback addresses are recognised', () => {
    ['127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1'].forEach((ip) =>
      expect(imageService.isPrivateAddress(ip)).toBe(true)
    );
    ['8.8.8.8', '1.1.1.1', '23.227.38.65'].forEach((ip) => expect(imageService.isPrivateAddress(ip)).toBe(false));
  });

  test('a non-HTTPS or non-allowlisted URL is refused', async () => {
    await expect(imageService.assertSafeUrl('http://cdn.shopify.com/x.jpg')).rejects.toThrow(/HTTPS/i);
    await expect(imageService.assertSafeUrl('https://evil.tld/x.jpg')).rejects.toThrow(/not allowed/i);
    await expect(imageService.assertSafeUrl('not a url')).rejects.toThrow(/valid URL/i);
  });

  test('a failed image never throws, so one bad image cannot abort an import', async () => {
    await expect(imageService.importImage('https://evil.tld/x.jpg')).resolves.toBeNull();
    await expect(imageService.importImages(['https://evil.tld/x.jpg', null])).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('import guards', () => {
  test('importing without a category is refused', async () => {
    await expect(
      importService.importProduct({ shopifyProductId: 'gid://shopify/Product/1', categoryId: null })
    ).rejects.toMatchObject({ code: 'CATEGORY_REQUIRED' });
  });

  test('importing a product that is already mapped is refused', async () => {
    const category = await createCategory();
    const product = await createProduct({ category: category._id, name: 'Already imported' });
    const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
    await ProductFulfillmentMapping.create({
      product: product._id,
      provider: 'SHOPIFY',
      externalProductId: 'gid://shopify/Product/dupe-1',
      variants: [{ externalVariantId: 'gid://shopify/ProductVariant/dupe-1' }],
    });

    await expect(
      importService.importProduct({
        shopifyProductId: 'gid://shopify/Product/dupe-1',
        categoryId: category._id,
      })
    ).rejects.toMatchObject({ code: 'ALREADY_IMPORTED' });
  });

  afterAll(async () => {
    await Product.deleteMany({ name: /Already imported|Existing product/ });
  });
});
