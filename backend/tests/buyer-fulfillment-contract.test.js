const crypto = require('crypto');

process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY =
  process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const request = require('supertest');
const app = require('../app');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Cart = require('../Models/Cart');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const { signToken } = require('../utils/jwt');
const { connectTestDb, disconnectTestDb, createCategory, createProduct, createCustomer } = require('./helpers');

// The contract between the server and the buyer's apps.
//
// Krozenda stores 'SHOPIFY' on an order. The web and native apps validate the
// value against `z.enum(['STANDARD','DROPSHIP'])` and an unknown one does not
// degrade gracefully — the parse throws and the whole orders screen fails to
// load, which is exactly what happened in production:
//
//   [{"code":"invalid_value","values":["STANDARD","DROPSHIP"],
//     "path":["fulfillmentType"],"message":"Invalid input"}]
//
// utils/buyerFulfillment.js translates at the boundary. This suite exists
// because that translation is easy to forget on a NEW endpoint, and the cost
// of forgetting is a blank screen rather than a missing field.

let buyer;
let auth;
let order;
let product;

// Walk the whole response, not just the fields we expect, so a leak anywhere
// in a nested shape is caught.
function findValue(value, needle, path = '$') {
  const hits = [];
  if (value === needle) hits.push(path);
  else if (Array.isArray(value)) value.forEach((v, i) => hits.push(...findValue(v, needle, `${path}[${i}]`)));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) hits.push(...findValue(v, needle, `${path}.${k}`));
  }
  return hits;
}

beforeAll(async () => {
  await connectTestDb();

  const category = await createCategory();
  product = await createProduct({ category: category._id, price: 500, stock: 10, fulfillmentProvider: 'SHOPIFY' });
  await ProductFulfillmentMapping.create({
    product: product._id,
    provider: 'SHOPIFY',
    externalProductId: `gid://shopify/Product/${Date.now()}`,
    externalSupplier: 'VFULFILL',
    variants: [{ externalVariantId: `gid://shopify/ProductVariant/${Date.now()}` }],
  });

  const customer = await createCustomer();
  buyer = customer.user || customer;
  auth = {
    Authorization: `Bearer ${signToken('user', { id: String(buyer._id), role: 'customer', mobileNumber: buyer.mobileNumber })}`,
  };

  order = await Order.create({
    user: buyer._id,
    items: [{ product: product._id, name: product.name, price: 500, quantity: 1 }],
    shippingAddress: {
      fullName: 'Ankit',
      phone: '9755620716',
      line1: '12 MG Road',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001',
    },
    subtotal: 500,
    shippingFee: 79,
    total: 579,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    fulfillmentType: 'SHOPIFY',
  });
});

afterAll(async () => {
  await Cart.deleteMany({ user: buyer._id });
  await disconnectTestDb();
});

// ---------------------------------------------------------------------------
describe('no buyer endpoint ever emits the internal fulfilment type', () => {
  const endpoints = [
    ['the orders list', () => `/user/orders`],
    ['one order', () => `/user/orders/${order._id}`],
    ['order tracking', () => `/user/orders/${order._id}/tracking`],
    ['the product list', () => `/catalog/products?limit=50`],
    ['one product', () => `/catalog/products/${product._id}`],
  ];

  test.each(endpoints)('%s never contains "SHOPIFY"', async (_label, url) => {
    const res = await request(app).get(url()).set(auth);
    expect(res.status).toBeLessThan(500);

    const leaks = findValue(res.body, 'SHOPIFY');
    // A leak here takes down the entire screen, not just one field.
    expect(leaks).toEqual([]);
  });

  test('the order reports a fulfilment type the apps can parse', async () => {
    const res = await request(app).get(`/user/orders/${order._id}`).set(auth);
    expect(res.status).toBe(200);
    expect(['STANDARD', 'DROPSHIP']).toContain(res.body.data.fulfillmentType);
  });

  // The order IS externally fulfilled — the point is that the buyer's apps are
  // told something they understand, not that the fact is hidden internally.
  test('the stored value is still SHOPIFY, untouched by the translation', async () => {
    const stored = await Order.findById(order._id).select('fulfillmentType').lean();
    expect(stored.fulfillmentType).toBe('SHOPIFY');
  });

  // isDropship drives "cannot be cancelled, returned or replaced" in the
  // apps. With a real cancel window that copy would be a lie.
  test('isDropship is false, so the apps do not show false copy', async () => {
    const res = await request(app).get(`/user/orders/${order._id}`).set(auth);
    expect(res.body.data.isDropship).toBe(false);
  });

  test('the cart is the one deliberate exception', async () => {
    await request(app)
      .post('/user/cart/items')
      .set(auth)
      .send({ productId: String(product._id), quantity: 1 })
      .expect(200);

    const res = await request(app).get('/user/cart').set(auth);
    const line = (res.body.data?.items || [])[0];
    // Still true here, and only here: online-payment-only, and "this becomes
    // more than one order". Flipped when COD is enabled for these items.
    expect(line?.isDropship).toBe(true);
    // Even so, the internal value must not appear.
    expect(findValue(res.body, 'SHOPIFY')).toEqual([]);
  });
});
