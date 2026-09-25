const request = require('supertest');
const app = require('../app');
const Order = require('../Models/Order');
const CjOrder = require('../Models/CjOrder');
const ReturnRequest = require('../Models/ReturnRequest');
const CommissionRule = require('../Models/CommissionRule');
const { USD_TO_INR_RATE } = require('../services/cj/cjPricing');
const {
  connectTestDb,
  disconnectTestDb,
  createAdmin,
  createCustomer,
  createVendor,
  createCategory,
  createProduct,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

// Every figure is a live aggregation over all orders, so each test starts
// from a clean slate rather than whatever earlier suites left behind.
beforeEach(async () => {
  await Promise.all([
    Order.deleteMany({}),
    CjOrder.deleteMany({}),
    ReturnRequest.deleteMany({}),
    CommissionRule.deleteMany({}),
  ]);
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const paise = (rupees) => Math.round(rupees * 100);

const ADDRESS = {
  fullName: 'Test Buyer',
  phone: '9998887771',
  line1: '1 Test Street',
  city: 'Indore',
  state: 'MP',
  pincode: '452001',
};

async function placeOrder({ user, lines, status = 'DELIVERED', fulfillmentType = 'STANDARD', discountAmount = 0 }) {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  return Order.create({
    user,
    items: lines.map((l) => ({
      product: l.product._id,
      name: l.product.name,
      price: l.price,
      quantity: l.quantity,
      vendor: l.vendor ?? null,
      status: l.status || status,
    })),
    shippingAddress: ADDRESS,
    subtotal,
    discountAmount,
    shippingFee: 50,
    total: subtotal - discountAmount + 50,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    fulfillmentType,
    status,
  });
}

async function setup() {
  const { user } = await createCustomer();
  const { token: adminToken } = await createAdmin();
  const category = await createCategory();
  // Asha pays the platform default (10%); the other seller has a negotiated
  // 20%, which lives in a SELLER rule — the only place a rate is read from.
  const { vendor: seller, token: sellerToken } = await createVendor({ name: 'Asha' });
  const { vendor: otherSeller } = await createVendor();
  await CommissionRule.create({ name: 'Negotiated', type: 'PERCENTAGE', value: 20, scope: 'SELLER', vendor: otherSeller._id });

  const ownProduct = await createProduct({ category: category._id, price: 1000, costPrice: 600 });
  const cjProduct = await createProduct({ category: category._id, price: 2000, fulfillmentProvider: 'CJ' });
  const sellerProduct = await createProduct({ category: category._id, price: 500, vendor: seller._id });
  const otherProduct = await createProduct({ category: category._id, price: 300, vendor: otherSeller._id });

  // Own stock: 2 × ₹1000, cost ₹600 each.
  await placeOrder({ user: user._id, lines: [{ product: ownProduct, price: 1000, quantity: 2 }] });

  // CJ: 1 × ₹2000; CJ charged $10 + $2 shipping.
  const cjOrder = await placeOrder({
    user: user._id,
    fulfillmentType: 'DROPSHIP',
    lines: [{ product: cjProduct, price: 2000, quantity: 1 }],
  });
  await CjOrder.create({
    krozendaOrderId: cjOrder._id,
    krozendaSubOrderId: `CJ-${cjOrder._id}`,
    items: [{ product: cjProduct._id, cjProductId: 'p', cjVariantId: 'v', quantity: 1, unitCost: 10 }],
    totalCost: 10,
    shippingCost: 2,
    status: 'SHIPPED',
  });

  // Sellers, in one mixed order: Asha 2 × ₹500 (one refunded ₹500), the
  // other seller 1 × ₹300 still in progress.
  const mixed = await placeOrder({
    user: user._id,
    lines: [
      { product: sellerProduct, price: 500, quantity: 2, vendor: seller._id },
      { product: otherProduct, price: 300, quantity: 1, vendor: otherSeller._id, status: 'PROCESSING' },
    ],
  });
  await ReturnRequest.create({
    user: user._id,
    order: mixed._id,
    product: sellerProduct._id,
    productName: sellerProduct.name,
    requestType: 'REFUND',
    reason: 'Damaged',
    status: 'APPROVED',
    refundAmount: 500,
    resolvedAt: new Date(),
  });

  // Never counted: a cancelled order, and a cancelled line.
  await placeOrder({
    user: user._id,
    status: 'CANCELLED',
    lines: [{ product: sellerProduct, price: 500, quantity: 4, vendor: seller._id }],
  });
  await placeOrder({
    user: user._id,
    lines: [{ product: ownProduct, price: 1000, quantity: 1, status: 'CANCELLED' }],
  });

  return { adminToken, sellerToken, seller, otherSeller };
}

describe('revenue', () => {
  test('admin sees every channel, what Krozenda earned from each, and every seller', async () => {
    const { adminToken, seller, otherSeller } = await setup();

    const res = await request(app).get('/admin/analytics/revenue?range=30d').set(auth(adminToken));
    expect(res.status).toBe(200);
    const { channels, totals, sellers } = res.body.data;
    const byKey = Object.fromEntries(channels.map((c) => [c.key, c]));

    expect(byKey.own_stock).toMatchObject({
      orders: 1,
      netSales: paise(2000),
      cost: paise(1200),
      earnings: paise(800),
    });

    const cjCost = paise(12 * USD_TO_INR_RATE);
    expect(byKey.cj).toMatchObject({ orders: 1, netSales: paise(2000), cost: cjCost, earnings: paise(2000) - cjCost });

    // Asha: ₹1000 sold, ₹500 refunded → ₹500 net; 10% commission on what stayed sold.
    // Other seller: ₹300, 20% commission, still in progress.
    expect(byKey.sellers).toMatchObject({
      orders: 1,
      sales: paise(1300),
      refunds: paise(500),
      netSales: paise(800),
      commission: paise(50 + 60),
      sellerEarnings: paise(450 + 240),
      inProgressSales: paise(300),
    });

    expect(totals.netSales).toBe(paise(2000 + 2000 + 800));
    expect(totals.earnings).toBe(paise(800) + (paise(2000) - cjCost) + paise(110));
    expect(totals.shippingFees).toBe(paise(150));

    // Each channel also has its own four figures, for the channel switcher.
    const { channelKpis } = res.body.data;
    const value = (key, kpiKey) => channelKpis[key].find((k) => k.key === kpiKey).value;
    expect(value('own_stock', 'earnings')).toBe(paise(800));
    expect(value('cj', 'cost')).toBe(cjCost);
    expect(value('sellers', 'commission')).toBe(paise(110));
    expect(value('sellers', 'netSales')).toBe(paise(800));

    expect(sellers.map((s) => s.id)).toEqual([String(seller._id), String(otherSeller._id)]);
    expect(sellers[0]).toMatchObject({ name: 'Asha', netSales: paise(500), commission: paise(50), sellerEarnings: paise(450) });
  });

  test('a seller sees exactly the figures admin sees for them, and nobody else', async () => {
    const { adminToken, sellerToken, seller } = await setup();

    const [mine, adminView] = await Promise.all([
      request(app).get('/vendor/earnings/revenue?range=30d').set(auth(sellerToken)),
      request(app).get(`/admin/analytics/revenue/sellers/${seller._id}?range=30d`).set(auth(adminToken)),
    ]);
    expect(mine.status).toBe(200);
    expect(adminView.status).toBe(200);
    expect(mine.body.data.totals).toEqual(adminView.body.data.totals);

    expect(mine.body.data.totals).toMatchObject({
      orders: 1,
      netSales: paise(500),
      commission: paise(50),
      sellerEarnings: paise(450),
    });
    expect(mine.body.data.products).toHaveLength(1);
    const trendTotal = mine.body.data.trend.reduce((sum, p) => sum + p.netSales, 0);
    expect(trendTotal).toBe(paise(500));
  });

  test('sellers cannot read the admin view', async () => {
    const { sellerToken } = await setup();
    const res = await request(app).get('/admin/analytics/revenue').set(auth(sellerToken));
    expect([401, 403]).toContain(res.status);
  });
});
