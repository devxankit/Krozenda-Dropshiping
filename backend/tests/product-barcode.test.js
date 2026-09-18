// Every product gets a real, scannable EAN-13 the moment it is created — see
// Models/Product.js and utils/barcode.js. These tests cover the guarantee
// itself (assigned, valid, unique, never reassigned) and the two ways a
// barcode is read back: a lookup by code (what a warehouse scan does) and a
// printable image.
const request = require('supertest');
const app = require('../app');
const Product = require('../Models/Product');
const { generateBarcode, isValidEan13, ean13CheckDigit } = require('../utils/barcode');

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

  it('400s something that is not a real barcode, without touching the database', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .get('/admin/catalog/products/barcode/not-a-barcode')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
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
