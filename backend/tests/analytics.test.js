const request = require('supertest');
const app = require('../app');
const Order = require('../Models/Order');
const ReturnRequest = require('../Models/ReturnRequest');
const Ticket = require('../Models/Ticket');
const Vendor = require('../Models/Vendor');
const {
  connectTestDb,
  disconnectTestDb,
  createAdmin,
  createCustomer,
  createProduct,
  uniqueSuffix,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

// Every figure these endpoints report is a live aggregation, so each test
// starts from a known set of orders rather than whatever earlier suites left
// behind.
beforeEach(async () => {
  await Promise.all([
    Order.deleteMany({}),
    ReturnRequest.deleteMany({}),
    Ticket.deleteMany({}),
    Vendor.deleteMany({}),
  ]);
});

const SHIPPING_ADDRESS = {
  fullName: 'Test Buyer',
  phone: '9998887771',
  line1: '123 Test Street',
  city: 'Testville',
  state: 'TS',
  pincode: '123456',
};

const DAY_MS = 24 * 60 * 60 * 1000;

async function createVendor(vendorType) {
  const suffix = uniqueSuffix();
  return Vendor.create({
    vendorType,
    name: `${vendorType} Seller ${suffix}`,
    email: `seller${suffix}@test.local`,
    mobile: '9998887770',
    password: 'Password@123',
    verificationStatus: 'APPROVED',
    isActive: true,
  });
}

// `items` here is [{ product, price, quantity, vendor? }]; everything else on
// the order is derived so a test only states what it is actually asserting on.
async function placeOrder({
  user,
  items,
  status = 'DELIVERED',
  paymentStatus = 'PAID',
  paymentMethod = 'RAZORPAY',
  daysAgo = 0,
}) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = await Order.create({
    user,
    items: items.map((item) => ({
      product: item.product._id,
      name: item.product.name,
      price: item.price,
      quantity: item.quantity,
      vendor: item.vendor ?? null,
    })),
    shippingAddress: SHIPPING_ADDRESS,
    subtotal,
    total: subtotal,
    paymentMethod,
    paymentStatus,
    status,
  });

  if (daysAgo > 0) {
    // timestamps:true would stamp createdAt back to now on a normal save.
    await Order.collection.updateOne(
      { _id: order._id },
      { $set: { createdAt: new Date(Date.now() - daysAgo * DAY_MS) } },
    );
  }

  return order;
}

function get(path, token) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`);
}

const kpi = (body, key) => body.data.kpis.find((row) => row.key === key);

describe('admin reporting — access control', () => {
  it('rejects an unauthenticated caller on every reporting route', async () => {
    for (const path of ['/admin/dashboard', '/admin/dashboard-summary', '/admin/analytics/sales']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });

  it('rejects a staff account without the reporting permissions', async () => {
    const { user } = await createCustomer();
    const { token } = await createAdmin({ role: 'staff', email: `staff${uniqueSuffix()}@test.local` });
    expect(user).toBeDefined();

    // createAdmin signs a token for the account it creates; a staff account
    // with no role document has no permissions at all.
    const res = await get('/admin/dashboard', token);
    expect(res.status).toBe(403);
  });
});

describe('GET /admin/dashboard', () => {
  it('reports GMV, orders and the pipeline from live orders, in paise', async () => {
    const { token } = await createAdmin();
    const { user } = await createCustomer();
    const product = await createProduct({ price: 500 });

    await placeOrder({ user: user._id, items: [{ product, price: 500, quantity: 2 }] });
    await placeOrder({
      user: user._id,
      items: [{ product, price: 500, quantity: 1 }],
      status: 'SHIPPED',
      paymentStatus: 'PENDING',
      paymentMethod: 'COD',
    });
    await placeOrder({
      user: user._id,
      items: [{ product, price: 500, quantity: 4 }],
      status: 'CANCELLED',
      paymentStatus: 'PENDING',
      paymentMethod: 'COD',
    });

    const res = await get('/admin/dashboard?range=30d', token);
    expect(res.status).toBe(200);

    // ₹1,000 + ₹500 delivered/shipped; the cancelled ₹2,000 is excluded.
    expect(kpi(res.body, 'gmv').value).toBe(150000);
    expect(kpi(res.body, 'orders').value).toBe(3);
    expect(kpi(res.body, 'aov').value).toBe(50000);
    // Only the RAZORPAY order was captured; COD counts on delivery.
    expect(kpi(res.body, 'captured').value).toBe(100000);

    const pipeline = Object.fromEntries(
      res.body.data.pipeline.map((stage) => [stage.status, stage.count]),
    );
    expect(pipeline.DELIVERED).toBe(1);
    expect(pipeline.SHIPPED).toBe(1);
    expect(pipeline.PENDING).toBe(0);

    const cancelled = res.body.data.exceptions.find((row) => row.label === 'Cancelled');
    expect(cancelled.count).toBe(1);
  });

  it('splits revenue into own stock, CJ Dropshipping and sellers', async () => {
    const { token } = await createAdmin();
    const { user } = await createCustomer();

    const marketplaceSeller = await createVendor('B2C');
    const partnerSeller = await createVendor('B2B');

    // Attribution reads the line's own vendor snapshot first, and falls back
    // to the product's owner — both paths are exercised here. A B2B partner
    // is a seller like any other; only CJ-fulfilled lines are CJ.
    const ownStock = await createProduct({ price: 100 });
    const partnerProduct = await createProduct({ price: 50, vendor: partnerSeller._id });
    const cjProduct = await createProduct({ price: 300, fulfillmentProvider: 'CJ' });

    await placeOrder({
      user: user._id,
      items: [
        { product: ownStock, price: 100, quantity: 1, vendor: marketplaceSeller._id },
        { product: partnerProduct, price: 50, quantity: 2 },
        { product: ownStock, price: 100, quantity: 1 },
        { product: cjProduct, price: 300, quantity: 1 },
      ],
    });

    const res = await get('/admin/dashboard?range=30d', token);
    expect(res.status).toBe(200);

    const totals = res.body.data.revenueByModel.reduce(
      (sums, point) => ({
        marketplace: sums.marketplace + point.marketplace,
        dropshipping: sums.dropshipping + point.dropshipping,
        own_stock: sums.own_stock + point.own_stock,
      }),
      { marketplace: 0, dropshipping: 0, own_stock: 0 },
    );

    expect(totals.marketplace).toBe(20000);
    expect(totals.own_stock).toBe(10000);
    expect(totals.dropshipping).toBe(30000);
    // The bands add back up to the headline GMV.
    expect(totals.marketplace + totals.own_stock + totals.dropshipping).toBe(kpi(res.body, 'gmv').value);
  });

  it('splits one order into a sub-order per seller', async () => {
    const { token } = await createAdmin();
    const { user } = await createCustomer();

    const seller = await createVendor('B2C');
    const ownStock = await createProduct({ price: 250 });
    const sellerProduct = await createProduct({ price: 750, vendor: seller._id });

    await placeOrder({
      user: user._id,
      items: [
        { product: ownStock, price: 250, quantity: 1 },
        { product: sellerProduct, price: 750, quantity: 1 },
      ],
    });

    const res = await get('/admin/dashboard?range=30d', token);
    const subOrders = res.body.data.recentSubOrders;

    expect(subOrders).toHaveLength(2);
    expect(subOrders.map((row) => row.id.slice(-2)).sort()).toEqual(['-A', '-B']);
    expect(subOrders.every((row) => row.status === 'DELIVERED')).toBe(true);
    expect(subOrders.reduce((sum, row) => sum + row.total, 0)).toBe(100000);

    const sellers = subOrders.map((row) => row.seller).sort();
    expect(sellers).toContain('Krozenda own stock');
    expect(sellers.some((name) => name.startsWith('B2C Seller'))).toBe(true);
  });

  it('scopes every figure to the range asked for, and falls back on a bad one', async () => {
    const { token } = await createAdmin();
    const { user } = await createCustomer();
    const product = await createProduct({ price: 1000 });

    await placeOrder({ user: user._id, items: [{ product, price: 1000, quantity: 1 }] });
    await placeOrder({ user: user._id, items: [{ product, price: 1000, quantity: 1 }], daysAgo: 45 });

    const week = await get('/admin/dashboard?range=7d', token);
    expect(kpi(week.body, 'orders').value).toBe(1);
    expect(week.body.data.granularity).toBe('day');

    const quarter = await get('/admin/dashboard?range=90d', token);
    expect(kpi(quarter.body, 'orders').value).toBe(2);
    expect(quarter.body.data.granularity).toBe('week');
    expect(quarter.body.data.revenueByModel).toHaveLength(13);

    // An unknown range is the default window, not an error.
    const nonsense = await get('/admin/dashboard?range=nonsense', token);
    expect(nonsense.status).toBe(200);
    expect(nonsense.body.data.range).toBe('30d');
  });

  it('lists only the queues that actually have work in them', async () => {
    const { token } = await createAdmin();
    await createVendor('B2C');
    const pending = await createVendor('B2B');
    await Vendor.updateOne({ _id: pending._id }, { $set: { verificationStatus: 'PENDING', isActive: false } });

    const res = await get('/admin/dashboard', token);
    const queue = Object.fromEntries(res.body.data.actionQueue.map((item) => [item.id, item.count]));

    expect(queue.kyc).toBe(1);
    // No orders, returns or tickets exist, so those rows are absent rather
    // than listed as zero.
    expect(queue.orders).toBeUndefined();
    expect(queue.returns).toBeUndefined();
    expect(queue.tickets).toBeUndefined();

    expect(kpi(res.body, 'sellers').value).toBe(1);
  });

  it('reports integration health from this server, with the database up', async () => {
    const { token } = await createAdmin();
    const res = await get('/admin/dashboard', token);

    const database = res.body.data.integrations.find((row) => row.id === 'mongodb');
    expect(database.status).toBe('operational');
    expect(res.body.data.integrations.every((row) => typeof row.name === 'string')).toBe(true);
  });
});

describe('GET /admin/analytics/sales', () => {
  it('counts captured payments by instrument and prices refunds against them', async () => {
    const { token } = await createAdmin();
    const { user } = await createCustomer();
    const product = await createProduct({ price: 1000 });

    // Captured: the online order and the delivered COD one.
    await placeOrder({ user: user._id, items: [{ product, price: 1000, quantity: 1 }] });
    await placeOrder({
      user: user._id,
      items: [{ product, price: 1000, quantity: 1 }],
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
    });
    // Not captured: COD still in flight.
    await placeOrder({
      user: user._id,
      items: [{ product, price: 1000, quantity: 1 }],
      status: 'SHIPPED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
    });
    // Refunded on cancellation.
    await placeOrder({
      user: user._id,
      items: [{ product, price: 200, quantity: 1 }],
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
    });

    const res = await get('/admin/analytics/sales?range=30d', token);
    expect(res.status).toBe(200);

    const mix = Object.fromEntries(res.body.data.paymentMix.map((row) => [row.label, row.value]));
    expect(mix['Online (Razorpay)']).toBe(1);
    expect(mix['Cash on delivery']).toBe(1);

    // ₹200 refunded against ₹2,000 captured.
    expect(kpi(res.body, 'refundRate').value).toBe(10);
    expect(kpi(res.body, 'revenue').value).toBe(300000);
    expect(res.body.data.revenueTrend).toHaveLength(30);
  });

  it('adds approved wallet refunds to the refund series', async () => {
    const { token } = await createAdmin();
    const { user } = await createCustomer();
    const product = await createProduct({ price: 1000 });

    const order = await placeOrder({ user: user._id, items: [{ product, price: 1000, quantity: 1 }] });

    await ReturnRequest.create({
      user: user._id,
      order: order._id,
      product: product._id,
      productName: product.name,
      requestType: 'REFUND',
      reason: 'Damaged on arrival',
      status: 'APPROVED',
      refundAmount: 250,
      resolvedAt: new Date(),
    });

    const res = await get('/admin/analytics/sales?range=30d', token);

    const refunds = res.body.data.revenueTrend.reduce((sum, point) => sum + point.refunds, 0);
    expect(refunds).toBe(25000);
    expect(kpi(res.body, 'refundRate').value).toBe(25);
  });

  it('ranks categories by revenue and counts the orders behind each', async () => {
    const { token } = await createAdmin();
    const { user } = await createCustomer();

    const cheap = await createProduct({ price: 100 });
    const dear = await createProduct({ price: 900 });

    await placeOrder({ user: user._id, items: [{ product: cheap, price: 100, quantity: 1 }] });
    await placeOrder({ user: user._id, items: [{ product: dear, price: 900, quantity: 1 }] });

    const res = await get('/admin/analytics/sales?range=30d', token);
    const [top] = res.body.data.topCategories;

    expect(top.revenue).toBe(90000);
    expect(top.orders).toBe(1);
    expect(res.body.data.topCategories.length).toBeLessThanOrEqual(6);
  });
});

describe('GET /admin/dashboard-summary', () => {
  it('counts customers, sellers, pending KYC and today only', async () => {
    const { token } = await createAdmin();
    const { user } = await createCustomer();
    const product = await createProduct({ price: 100 });

    await createVendor('B2C');
    const pending = await createVendor('B2B');
    await Vendor.updateOne({ _id: pending._id }, { $set: { verificationStatus: 'UNDER_REVIEW' } });

    await placeOrder({ user: user._id, items: [{ product, price: 100, quantity: 1 }] });
    await placeOrder({ user: user._id, items: [{ product, price: 100, quantity: 1 }], daysAgo: 3 });

    const res = await get('/admin/dashboard-summary', token);

    expect(res.status).toBe(200);
    expect(res.body.data.totalSellers).toBe(2);
    expect(res.body.data.pendingApprovals).toBe(1);
    expect(res.body.data.ordersToday).toBe(1);
    expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(1);
  });
});
