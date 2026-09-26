// Every product gets a real, scannable EAN-13 the moment it is created — see
// Models/Product.js and utils/barcode.js. These tests cover the guarantee
// itself (assigned, valid, unique, never reassigned) and the two ways a
// barcode is read back: a lookup by code (what a warehouse scan does) and a
// printable image.
const request = require('supertest');
const app = require('../app');
const Product = require('../Models/Product');
const { generateBarcode, isValidEan13, ean13CheckDigit, productQrText, barcodeText } = require('../utils/barcode');

const { connectTestDb, disconnectTestDb, createProduct, createCategory, createAdmin, createVendor } = require('./helpers');

beforeAll(async () => {
  await connectTestDb();
  // The unique index on `barcode` is built in the background by Mongoose;
  // without waiting for it, a duplicate-key test can race a write past an
  // index that has not finished building yet and see it wrongly succeed.
  await Product.init();
});
afterAll(disconnectTestDb);

describe('utils/barcode', () => {
  it('generates a structurally valid EAN-13', async () => {
    const code = await generateBarcode();
    expect(code).toMatch(/^\d{13}$/);
    expect(isValidEan13(code)).toBe(true);
  });

  it('starts with the GS1 internal-use prefix, never a real retail range', async () => {
    const code = await generateBarcode();
    expect(code.slice(0, 2)).toBe('20');
  });

  it('two calls never collide', async () => {
    const [a, b] = await Promise.all([generateBarcode(), generateBarcode()]);
    expect(a).not.toBe(b);
  });

  it('rejects a code whose checksum was tampered with', () => {
    // Same 12 digits as a real generated code, last digit corrupted.
    const good = '2' + '0'.repeat(11) + ean13CheckDigit('2' + '0'.repeat(11));
    const bad = good.slice(0, 12) + String((Number(good[12]) + 1) % 10);
    expect(isValidEan13(good)).toBe(true);
    expect(isValidEan13(bad)).toBe(false);
  });

  it('rejects anything that is not 13 digits', () => {
    expect(isValidEan13('12345')).toBe(false);
    expect(isValidEan13('abcdefghijklm')).toBe(false);
    expect(isValidEan13('')).toBe(false);
    expect(isValidEan13(undefined)).toBe(false);
  });
});

describe('Product: barcode assignment', () => {
  it('is assigned automatically on creation', async () => {
    const product = await createProduct();
    expect(product.barcode).toMatch(/^\d{13}$/);
    expect(isValidEan13(product.barcode)).toBe(true);
  });

  it('two products created back to back get different barcodes', async () => {
    const [a, b] = await Promise.all([createProduct(), createProduct()]);
    expect(a.barcode).not.toBe(b.barcode);
  });

  it('is never reassigned on update', async () => {
    const product = await createProduct();
    const original = product.barcode;

    product.name = 'Renamed after creation';
    await product.save();
    expect(product.barcode).toBe(original);

    // And from a fresh read, not just the in-memory document.
    const reloaded = await Product.findById(product._id).lean();
    expect(reloaded.barcode).toBe(original);
  });

  it('refuses to store two products under the same barcode', async () => {
    const first = await createProduct();
    const category = await createCategory();

    await expect(
      Product.create({
        name: 'Duplicate barcode attempt',
        category: category._id,
        price: 500,
        stock: 1,
        barcode: first.barcode,
      })
    ).rejects.toThrow();
  });
});

describe('GET /admin/catalog/products/barcode/:code', () => {
  it('finds the product by its barcode', async () => {
    const { token } = await createAdmin();
    const product = await createProduct({ name: 'Scannable Widget' });

    const res = await request(app)
      .get(`/admin/catalog/products/barcode/${product.barcode}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product._id.toString());
    expect(res.body.data.name).toBe('Scannable Widget');
  });

  it('404s a well-formed but unknown barcode', async () => {
    const { token } = await createAdmin();
    const unknown = await generateBarcode(); // valid shape, never attached to a product

    const res = await request(app)
      .get(`/admin/catalog/products/barcode/${unknown}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('finds the product by its SKU — what the label barcode carries', async () => {
    const { token } = await createAdmin();
    const sku = `SCAN-${Date.now()}`;
    const product = await createProduct({ sku });

    const res = await request(app)
      .get(`/admin/catalog/products/barcode/${encodeURIComponent(sku)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product._id.toString());
  });

  it('404s an unknown SKU, and 400s an input too long to be a code', async () => {
    const { token } = await createAdmin();

    const unknown = await request(app)
      .get('/admin/catalog/products/barcode/not-a-real-sku')
      .set('Authorization', `Bearer ${token}`);
    expect(unknown.status).toBe(404);

    const tooLong = await request(app)
      .get(`/admin/catalog/products/barcode/${'X'.repeat(65)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(tooLong.status).toBe(400);
  });

  it('requires admin auth', async () => {
    const product = await createProduct();
    const res = await request(app).get(`/admin/catalog/products/barcode/${product.barcode}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/catalog/products/:id/barcode.png', () => {
  it('renders a PNG', async () => {
    const { token } = await createAdmin();
    const product = await createProduct();

    const res = await request(app)
      .get(`/admin/catalog/products/${product._id}/barcode.png`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    // PNG magic bytes.
    expect(res.body.slice(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('encodes the SKU, so a SKU edit changes it (and a price edit does not); never cached', async () => {
    const { token } = await createAdmin();
    const product = await createProduct({ sku: `LBL-${Date.now()}`, price: 500 });
    const fetchPng = () =>
      request(app).get(`/admin/catalog/products/${product._id}/barcode.png`).set('Authorization', `Bearer ${token}`);

    const before = await fetchPng();
    expect(before.headers['cache-control']).toBe('no-cache');

    await Product.updateOne({ _id: product._id }, { $set: { price: 650 } });
    expect(Buffer.compare(before.body, (await fetchPng()).body)).toBe(0);

    await Product.updateOne({ _id: product._id }, { $set: { sku: `${product.sku}-B` } });
    expect(Buffer.compare(before.body, (await fetchPng()).body)).not.toBe(0);
  });

  it('falls back to the barcode number when the SKU cannot be encoded', () => {
    expect(barcodeText({ sku: 'AB-12', barcode: '2000000000015' })).toBe('AB-12');
    expect(barcodeText({ sku: '', barcode: '2000000000015' })).toBe('2000000000015');
    expect(barcodeText({ sku: 'कुर्ता-1', barcode: '2000000000015' })).toBe('2000000000015');
  });
});

describe('vendor barcode lookup is scoped to the seller\'s own catalog', () => {
  it('finds a product that belongs to the calling seller', async () => {
    const { vendor, token } = await createVendor();
    const category = await createCategory();
    const product = await createProduct({ vendor: vendor._id, category: category._id });

    const res = await request(app)
      .get(`/vendor/products/barcode/${product.barcode}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product._id.toString());
  });

  it("finds the seller's own product by SKU, but not another seller's", async () => {
    const { vendor, token } = await createVendor();
    const { vendor: other } = await createVendor();
    const category = await createCategory();
    const mine = await createProduct({ vendor: vendor._id, category: category._id, sku: `MINE-${Date.now()}` });
    const theirs = await createProduct({ vendor: other._id, category: category._id, sku: `THEIRS-${Date.now()}` });

    const found = await request(app).get(`/vendor/products/barcode/${mine.sku}`).set('Authorization', `Bearer ${token}`);
    expect(found.status).toBe(200);
    expect(found.body.data.id).toBe(mine._id.toString());

    const hidden = await request(app).get(`/vendor/products/barcode/${theirs.sku}`).set('Authorization', `Bearer ${token}`);
    expect(hidden.status).toBe(404);
  });

  it('refuses to reveal a product that belongs to a different seller', async () => {
    const { vendor: owner } = await createVendor();
    const { token: otherToken } = await createVendor();
    const category = await createCategory();
    const product = await createProduct({ vendor: owner._id, category: category._id });

    const res = await request(app)
      .get(`/vendor/products/barcode/${product.barcode}`)
      .set('Authorization', `Bearer ${otherToken}`);

    // Not the seller's own product, so the query finds nothing — exactly the
    // same response as a barcode that does not exist at all, which is the
    // point: the endpoint gives no signal that the code belongs to someone.
    expect(res.status).toBe(404);
  });

  it('will not render a barcode image for a product outside the seller\'s catalog', async () => {
    const { vendor: owner } = await createVendor();
    const { token: otherToken } = await createVendor();
    const category = await createCategory();
    const product = await createProduct({ vendor: owner._id, category: category._id });

    const res = await request(app)
      .get(`/vendor/products/${product._id}/barcode.png`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});

describe('product QR code', () => {
  it('carries the barcode first, then the product details, on one line', () => {
    const text = productQrText({
      barcode: '2000000000015',
      name: 'Steel Bottle',
      sku: 'SB-1',
      price: 500,
      salePrice: 450,
      mrp: 600,
      brand: { name: 'Acme' },
      category: { name: 'Kitchen' },
    });
    expect(text.startsWith('2000000000015 | Steel Bottle')).toBe(true);
    expect(text).toContain('SKU: SB-1');
    expect(text).toContain('Price: Rs.450');
    expect(text).toContain('MRP: Rs.600');
    expect(text).toContain('Brand: Acme');
    expect(text).not.toMatch(/\n/);
  });

  it('renders a PNG for admin, including a non-Latin product name', async () => {
    const { token } = await createAdmin();
    const product = await createProduct({ name: 'स्टील बोतल' });

    const res = await request(app)
      .get(`/admin/catalog/products/${product._id}/qrcode.png`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.body.slice(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('renders for the owning seller only', async () => {
    const { vendor: owner, token: ownerToken } = await createVendor();
    const { token: otherToken } = await createVendor();
    const category = await createCategory();
    const product = await createProduct({ vendor: owner._id, category: category._id });

    const own = await request(app)
      .get(`/vendor/products/${product._id}/qrcode.png`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(own.status).toBe(200);

    const other = await request(app)
      .get(`/vendor/products/${product._id}/qrcode.png`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(other.status).toBe(404);
  });
});

describe('backfill-product-barcodes', () => {
  it('assigns a barcode to a product that predates the field, and skips one that already has one', async () => {
    const category = await createCategory();
    // Bypasses the pre-save hook on purpose, to simulate a document written
    // before `barcode` existed — the hook only fires on a genuinely new save.
    const legacy = await Product.collection.insertOne({
      name: 'Pre-existing product',
      category: category._id,
      price: 1000,
      stock: 5,
      isActive: true,
      barcode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const alreadyDone = await createProduct();

    const { run } = require('../backfill-product-barcodes');
    const result = await run({ apply: true, connect: false, close: false });

    expect(result.total).toBeGreaterThanOrEqual(1);

    const reloaded = await Product.findById(legacy.insertedId).lean();
    expect(reloaded.barcode).toMatch(/^\d{13}$/);

    // Re-running is a no-op for what it already fixed.
    const second = await run({ apply: true, connect: false, close: false });
    const stillTheSame = await Product.findById(legacy.insertedId).lean();
    expect(stillTheSame.barcode).toBe(reloaded.barcode);
    expect(second.total).toBe(0);

    // Never touched a product that already had one.
    const untouched = await Product.findById(alreadyDone._id).lean();
    expect(untouched.barcode).toBe(alreadyDone.barcode);
  });
});

describe('GET /admin/catalog/products/:id', () => {
  it('returns the product with its category and seller resolved', async () => {
    const { token } = await createAdmin();
    const { vendor } = await createVendor({ business: { businessName: 'Acme Traders' } });
    const product = await createProduct({ name: 'Detail Widget', vendor: vendor._id });

    const res = await request(app)
      .get(`/admin/catalog/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product._id.toString());
    expect(res.body.data.name).toBe('Detail Widget');
    expect(res.body.data.category.name).toBeTruthy();
    expect(res.body.data.vendor).toBe(vendor._id.toString());
    expect(res.body.data.vendorDetails).toMatchObject({ id: vendor._id.toString(), name: 'Acme Traders' });
    expect(res.body.data.fulfillmentProvider).toBeNull();
  });

  it('404s an unknown id and 400s a malformed one', async () => {
    const { token } = await createAdmin();

    const missing = await request(app)
      .get('/admin/catalog/products/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);

    const malformed = await request(app)
      .get('/admin/catalog/products/not-an-id')
      .set('Authorization', `Bearer ${token}`);
    expect(malformed.status).toBe(400);
  });

  it('requires admin auth', async () => {
    const product = await createProduct();
    const res = await request(app).get(`/admin/catalog/products/${product._id}`);
    expect(res.status).toBe(401);
  });
});
