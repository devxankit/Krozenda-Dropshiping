const crypto = require('crypto');

process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY =
  process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const request = require('supertest');
const app = require('../app');
const Product = require('../Models/Product');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const { connectTestDb, disconnectTestDb, createAdmin, createCategory, createProduct } = require('./helpers');

// Admin > Dropshipping, the review step.
//
// The point of this screen is that an imported product is a DRAFT until an
// admin has priced it and published it. These tests guard the three ways that
// promise can be broken: publishing something nobody can buy, selling below
// what the supplier charges, and editing a product this screen does not own.

let admin;
let category;

async function importedProduct(overrides = {}) {
  const product = await createProduct({
    category: category._id,
    name: `Imported ${Date.now()}${Math.random()}`,
    price: 500,
    costPrice: 200,
    stock: 0,
    isActive: false,
    status: 'Draft',
    fulfillmentProvider: 'SHOPIFY',
    ...overrides,
  });
  await ProductFulfillmentMapping.create({
    product: product._id,
    provider: 'SHOPIFY',
    externalProductId: `gid://shopify/Product/${Date.now()}${Math.floor(Math.random() * 1e6)}`,
    variants: [{ externalVariantId: `gid://shopify/ProductVariant/${Math.random()}` }],
  });
  return product;
}

beforeAll(async () => {
  await connectTestDb();
  admin = await createAdmin();
  category = await createCategory();
});
afterAll(async () => {
  await disconnectTestDb();
});

const auth = () => ({ Authorization: `Bearer ${admin.token}` });

// ---------------------------------------------------------------------------
describe('publishing', () => {
  test('a product with no stock is not published by accident', async () => {
    const product = await importedProduct({ stock: 0 });

    const res = await request(app)
      .patch(`/admin/shopify/products/${product._id}`)
      .set(auth())
      .send({ isActive: true });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NO_STOCK');
    // Still a draft: a refused publish must not half-apply.
    expect((await Product.findById(product._id)).isActive).toBe(false);
  });

  test('…but it can be published deliberately', async () => {
    const product = await importedProduct({ stock: 0 });

    const res = await request(app)
      .patch(`/admin/shopify/products/${product._id}`)
      .set(auth())
      .send({ isActive: true, allowOutOfStock: true });

    expect(res.status).toBe(200);
    const fresh = await Product.findById(product._id);
    expect(fresh.isActive).toBe(true);
    expect(fresh.status).toBe('Active');
  });

  test('a product with stock publishes without ceremony', async () => {
    const product = await importedProduct({ stock: 12 });

    await request(app)
      .patch(`/admin/shopify/products/${product._id}`)
      .set(auth())
      .send({ isActive: true })
      .expect(200);

    expect((await Product.findById(product._id)).isActive).toBe(true);
  });

  test('unpublishing takes it off the storefront', async () => {
    const product = await importedProduct({ stock: 5, isActive: true, status: 'Active' });

    await request(app)
      .patch(`/admin/shopify/products/${product._id}`)
      .set(auth())
      .send({ isActive: false })
      .expect(200);

    const fresh = await Product.findById(product._id);
    expect(fresh.isActive).toBe(false);
    expect(fresh.status).toBe('Draft');
  });
});

// ---------------------------------------------------------------------------
describe('pricing', () => {
  test('the admin price is what the product sells for', async () => {
    const product = await importedProduct({ price: 500, costPrice: 200 });

    const res = await request(app)
      .patch(`/admin/shopify/products/${product._id}`)
      .set(auth())
      .send({ price: 899 })
      .expect(200);

    expect(res.body.data.price).toBe(899);
    expect((await Product.findById(product._id)).price).toBe(899);
  });

  // The supplier's cost is their own figure, so this check can never be wrong
  // in Krozenda's favour — which is why it refuses rather than warns.
  test('selling below the supplier cost is refused', async () => {
    const product = await importedProduct({ price: 500, costPrice: 200 });

    const res = await request(app)
      .patch(`/admin/shopify/products/${product._id}`)
      .set(auth())
      .send({ price: 150 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BELOW_COST');
    expect((await Product.findById(product._id)).price).toBe(500);
  });

  test('…unless the loss is deliberate', async () => {
    const product = await importedProduct({ price: 500, costPrice: 200 });

    await request(app)
      .patch(`/admin/shopify/products/${product._id}`)
      .set(auth())
      .send({ price: 150, allowBelowCost: true })
      .expect(200);

    expect((await Product.findById(product._id)).price).toBe(150);
  });

  test('a zero or negative price is rejected outright', async () => {
    const product = await importedProduct();
    await request(app).patch(`/admin/shopify/products/${product._id}`).set(auth()).send({ price: 0 }).expect(400);
    await request(app).patch(`/admin/shopify/products/${product._id}`).set(auth()).send({ price: -5 }).expect(400);
  });

  test('an MRP below the selling price is rejected, since it would show a negative discount', async () => {
    const product = await importedProduct({ price: 500, costPrice: 100 });

    const res = await request(app)
      .patch(`/admin/shopify/products/${product._id}`)
      .set(auth())
      .send({ mrp: 300 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/negative discount/i);
  });
});

// ---------------------------------------------------------------------------
describe('ownership', () => {
  test('a product that was not imported from Shopify cannot be edited here', async () => {
    const ordinary = await createProduct({ category: category._id, name: 'Own stock item', price: 100 });

    const res = await request(app)
      .patch(`/admin/shopify/products/${ordinary._id}`)
      .set(auth())
      .send({ price: 999 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_IMPORTED');
    expect((await Product.findById(ordinary._id)).price).toBe(100);
  });

  test('removing an imported product deletes it from Krozenda only', async () => {
    const product = await importedProduct();

    await request(app).delete(`/admin/shopify/products/${product._id}`).set(auth()).expect(200);

    expect(await Product.findById(product._id)).toBeNull();
    expect(await ProductFulfillmentMapping.findOne({ product: product._id })).toBeNull();
  });

  test('a product that has been ordered is kept, not deleted', async () => {
    const product = await importedProduct({ stock: 5 });
    const Order = require('../Models/Order');
    const Customer = require('../Models/Customer');
    const buyer = await Customer.create({ name: 'Ordered', mobileNumber: `9${Date.now()}`.slice(0, 10) });

    await Order.create({
      user: buyer._id,
      items: [{ product: product._id, name: product.name, price: 500, quantity: 1 }],
      shippingAddress: {
        fullName: 'A',
        phone: '9999999999',
        line1: 'L',
        city: 'C',
        state: 'S',
        pincode: '411001',
      },
      subtotal: 500,
      total: 500,
      paymentMethod: 'RAZORPAY',
    });

    const res = await request(app).delete(`/admin/shopify/products/${product._id}`).set(auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HAS_ORDERS');
    expect(await Product.findById(product._id)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('bulk publish', () => {
  test('publishes the ones with stock and skips the ones without', async () => {
    const withStock = await importedProduct({ stock: 9 });
    const withoutStock = await importedProduct({ stock: 0 });

    const res = await request(app)
      .post('/admin/shopify/products/bulk')
      .set(auth())
      .send({ productIds: [String(withStock._id), String(withoutStock._id)], isActive: true })
      .expect(200);

    expect(res.body.data.updated).toBe(1);
    expect((await Product.findById(withStock._id)).isActive).toBe(true);
    expect((await Product.findById(withoutStock._id)).isActive).toBe(false);
  });

  test('a product that is not Shopify-imported is ignored by a bulk publish', async () => {
    const ordinary = await createProduct({ category: category._id, name: 'Not imported', stock: 10, isActive: false });

    await request(app)
      .post('/admin/shopify/products/bulk')
      .set(auth())
      .send({ productIds: [String(ordinary._id)], isActive: true })
      .expect(200);

    expect((await Product.findById(ordinary._id)).isActive).toBe(false);
  });
});
