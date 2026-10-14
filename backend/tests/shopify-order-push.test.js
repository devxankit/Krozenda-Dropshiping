const crypto = require('crypto');

process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY =
  process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const mongoose = require('mongoose');
const Order = require('../Models/Order');
const ShopifyOrderPush = require('../Models/ShopifyOrderPush');
const ShopifySettings = require('../Models/ShopifySettings');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const orderPushService = require('../services/shopify/orderPushService');
const shopifyOrderService = require('../services/shopify/shopifyOrderService');
const inboundOrderSync = require('../services/shopify/inboundOrderSync');
const { quoteShopifyGroup } = require('../services/shipping/shopifyRateService');
const { buyerFulfillmentType, buyerIsDropship } = require('../utils/buyerFulfillment');
const { toProvinceCode } = require('../utils/indianStates');
const { connectTestDb, disconnectTestDb, createCategory, createProduct, createCustomer } = require('./helpers');

const ADDRESS = {
  fullName: 'Asha Menon',
  phone: '9876543210',
  line1: '12 MG Road',
  line2: 'Flat 4',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
};

async function makeOrder({ fulfillmentType = 'SHOPIFY', ...overrides } = {}) {
  const category = await createCategory();
  const product = await createProduct({ category: category._id, price: 500, stock: 10 });
  const customer = await createCustomer();
  return Order.create({
    user: customer.user?._id || customer._id,
    items: [{ product: product._id, name: product.name, price: 500, quantity: 1 }],
    shippingAddress: ADDRESS,
    subtotal: 500,
    total: 500,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    fulfillmentType,
    ...overrides,
  });
}

beforeAll(async () => {
  await connectTestDb();
  // Build the indexes explicitly. A fresh test database has none, so the
  // uniqueness this suite relies on would not be enforced and the test would
  // pass by accident rather than by design.
  await Order.createIndexes();
  await ShopifyOrderPush.createIndexes();
});
afterAll(async () => {
  await disconnectTestDb();
});

// ShopifySettings is a singleton shared by the whole test database. The
// delivery-rate tests below switch rates ON, and a suite that leaves them on
// changes the answer for every other suite — an unconfigured rate is supposed
// to BLOCK a checkout, and a leaked one silently lets it through.
afterEach(async () => {
  await ShopifySettings.updateOne(
    { key: 'GLOBAL' },
    { $set: { shippingRules: { configured: false }, orderPushGraceMinutes: 15, pushAsTestOrders: false } }
  );
});

beforeEach(async () => {
  await ShopifyOrderPush.deleteMany({});
  await ProductFulfillmentMapping.deleteMany({});
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
describe('the order model accepts the new type', () => {
  test("'SHOPIFY' is a valid fulfillmentType, appended after STANDARD", () => {
    expect(Order.FULFILLMENT_TYPES).toContain('SHOPIFY');
    // Order matters: the FIRST present type carries the platform fee and the
    // coupon redemption, so STANDARD must stay at index 0.
    expect(Order.FULFILLMENT_TYPES[0]).toBe('STANDARD');
  });

  test('one payment can cover a STANDARD and a SHOPIFY order', async () => {
    const paymentId = `pay_${Date.now()}`;
    const a = await makeOrder({ fulfillmentType: 'STANDARD', razorpayPaymentId: paymentId });
    const b = await makeOrder({ fulfillmentType: 'SHOPIFY', razorpayPaymentId: paymentId });
    // The unique index is (razorpayPaymentId, fulfillmentType), so this is
    // legal — and a THIRD order on the same payment and type would not be.
    expect(String(a._id)).not.toBe(String(b._id));
    await expect(makeOrder({ fulfillmentType: 'SHOPIFY', razorpayPaymentId: paymentId })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe('delivery rates', () => {
  async function withRules(rules) {
    const settings = await ShopifySettings.getSettings();
    settings.shippingRules = rules;
    await settings.save();
  }

  const entries = [{ quantity: 2 }, { quantity: 1 }];

  // The single most important property: an unconfigured rate BLOCKS the sale
  // rather than shipping free. Free shipping nobody chose is invisible until
  // the month is added up.
  test('an unconfigured rate fails closed', async () => {
    await withRules({ configured: false, mode: 'FLAT_PER_ORDER', flatAmount: 99 });
    const quote = await quoteShopifyGroup({ entries, subtotal: 1000 });
    expect(quote.ok).toBe(false);
    expect(quote.reason).toBe('SHOPIFY_RATE_NOT_CONFIGURED');
    expect(quote.charge).toBeUndefined();
  });

  test('flat per order ignores quantity', async () => {
    await withRules({ configured: true, mode: 'FLAT_PER_ORDER', flatAmount: 79 });
    expect((await quoteShopifyGroup({ entries, subtotal: 100 })).charge).toBe(79);
  });

  test('per item multiplies by units, not by lines', async () => {
    await withRules({ configured: true, mode: 'PER_ITEM', perItemAmount: 20 });
    // 3 units across 2 lines.
    expect((await quoteShopifyGroup({ entries, subtotal: 100 })).charge).toBe(60);
  });

  test('flat plus per item adds both', async () => {
    await withRules({ configured: true, mode: 'FLAT_PLUS_PER_ITEM', flatAmount: 50, perItemAmount: 10 });
    expect((await quoteShopifyGroup({ entries, subtotal: 100 })).charge).toBe(80);
  });

  test('the free threshold is measured on the amount passed in', async () => {
    await withRules({ configured: true, mode: 'FLAT_PER_ORDER', flatAmount: 79, freeAboveCartValue: 999 });
    expect((await quoteShopifyGroup({ entries, subtotal: 998 })).charge).toBe(79);
    expect((await quoteShopifyGroup({ entries, subtotal: 999 })).charge).toBe(0);
  });

  test('an empty group is refused rather than quoted at zero', async () => {
    await withRules({ configured: true, mode: 'FLAT_PER_ORDER', flatAmount: 79 });
    expect((await quoteShopifyGroup({ entries: [], subtotal: 100 })).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('the push queue', () => {
  test('a scheduled push is claimed only once, even concurrently', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({ order: order._id, dueAt: new Date(Date.now() - 1000), status: 'SCHEDULED' });

    // Two workers racing. The claim is one atomic findOneAndUpdate, so
    // exactly one can win — otherwise the supplier gets two orders.
    const [a, b] = await Promise.all([ShopifyOrderPush.claimNext(), ShopifyOrderPush.claimNext()]);
    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);
    expect(winners[0].status).toBe('PUSHING');
    expect(winners[0].attempts).toBe(1);
  });

  test('a push is not claimed before its cancel window has passed', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({ order: order._id, dueAt: new Date(Date.now() + 60_000), status: 'SCHEDULED' });
    expect(await ShopifyOrderPush.claimNext()).toBeNull();
  });

  test('a claim abandoned by a dead worker is reclaimable', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      dueAt: new Date(Date.now() - 1000),
      status: 'PUSHING',
      claimedAt: new Date(Date.now() - (ShopifyOrderPush.STALE_CLAIM_MS + 1000)),
    });
    expect(await ShopifyOrderPush.claimNext()).not.toBeNull();
  });

  test('one order cannot have two push rows', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({ order: order._id, dueAt: new Date() });
    await expect(ShopifyOrderPush.create({ order: order._id, dueAt: new Date() })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Several dropshipping apps watch the same Shopify orders. One order holding
// two suppliers' lines can be fulfilled by BOTH — two parcels shipped and
// billed for one sale, discovered only when the money is gone.
describe('splitting an order per supplier', () => {
  async function productFrom(supplier, price) {
    const category = await createCategory();
    const product = await createProduct({ category: category._id, price, stock: 10 });
    await ProductFulfillmentMapping.create({
      product: product._id,
      provider: 'SHOPIFY',
      externalProductId: `gid://shopify/Product/${Math.random()}`,
      externalSupplier: supplier,
      variants: [{ externalVariantId: `gid://shopify/ProductVariant/${Math.random()}`, providerCost: price * 0.3 }],
    });
    return product;
  }

  async function orderOf(lines, { shippingFee = 0 } = {}) {
    const customer = await createCustomer();
    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    return Order.create({
      user: customer.user?._id || customer._id,
      items: lines,
      shippingAddress: ADDRESS,
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PAID',
      fulfillmentType: 'SHOPIFY',
    });
  }

  test('a mixed cart becomes one push per supplier, each with only its own lines', async () => {
    const a = await productFrom('VFULFILL', 600);
    const b = await productFrom('DROPSHIP_INDIA', 400);
    const order = await orderOf(
      [
        { product: a._id, name: a.name, price: 600, quantity: 1 },
        { product: b._id, name: b.name, price: 400, quantity: 1 },
      ],
      { shippingFee: 100 }
    );

    const groups = await orderPushService.groupBySupplier(order);
    expect(groups).toHaveLength(2);

    const vf = groups.find((g) => g.supplier === 'VFULFILL');
    const di = groups.find((g) => g.supplier === 'DROPSHIP_INDIA');
    expect(vf.productIds.map(String)).toEqual([String(a._id)]);
    expect(di.productIds.map(String)).toEqual([String(b._id)]);
    expect(vf.subtotal).toBe(600);
    expect(di.subtotal).toBe(400);
  });

  // Charging each supplier's Shopify order the full delivery fee would
  // overstate the store's revenue by a multiple of the supplier count.
  test('delivery is apportioned by value and always sums back to what the buyer paid', async () => {
    const a = await productFrom('VFULFILL', 600);
    const b = await productFrom('DROPSHIP_INDIA', 400);
    const order = await orderOf(
      [
        { product: a._id, name: a.name, price: 600, quantity: 1 },
        { product: b._id, name: b.name, price: 400, quantity: 1 },
      ],
      { shippingFee: 99 }
    );

    const groups = await orderPushService.groupBySupplier(order);
    const summed = groups.reduce((sum, g) => sum + g.shippingFee, 0);
    expect(Math.round(summed * 100) / 100).toBe(99);
    expect(groups.find((g) => g.supplier === 'VFULFILL').shippingFee).toBeCloseTo(59.4, 2);
  });

  test('a single-supplier order is still one push, with cost times quantity', async () => {
    const a = await productFrom('VFULFILL', 500);
    const order = await orderOf([{ product: a._id, name: a.name, price: 500, quantity: 2 }], { shippingFee: 50 });

    const groups = await orderPushService.groupBySupplier(order);
    expect(groups).toHaveLength(1);
    expect(groups[0].shippingFee).toBe(50);
    expect(groups[0].subtotal).toBe(1000);
    expect(groups[0].providerCost).toBe(300);
  });

  test('cancelled lines are not sent to anyone', async () => {
    const a = await productFrom('VFULFILL', 500);
    const b = await productFrom('DROPSHIP_INDIA', 300);
    const order = await orderOf(
      [
        { product: a._id, name: a.name, price: 500, quantity: 1 },
        { product: b._id, name: b.name, price: 300, quantity: 1, status: 'CANCELLED' },
      ],
      { shippingFee: 50 }
    );

    const groups = await orderPushService.groupBySupplier(order);
    expect(groups).toHaveLength(1);
    expect(groups[0].supplier).toBe('VFULFILL');
  });

  test('one order can hold a push per supplier, but never two for the same one', async () => {
    const a = await productFrom('VFULFILL', 100);
    const order = await orderOf([{ product: a._id, name: a.name, price: 100, quantity: 1 }]);

    await ShopifyOrderPush.create({ order: order._id, supplier: 'VFULFILL', dueAt: new Date() });
    await ShopifyOrderPush.create({ order: order._id, supplier: 'DROPSHIP_INDIA', dueAt: new Date() });
    await expect(
      ShopifyOrderPush.create({ order: order._id, supplier: 'VFULFILL', dueAt: new Date() })
    ).rejects.toThrow();

    expect(await ShopifyOrderPush.countDocuments({ order: order._id })).toBe(2);
  });

  // All-or-nothing: cancelling the buyer's order while one supplier is
  // already shipping refunds them for a parcel that is still coming.
  test('an order is only cancellable while EVERY supplier push is unsent', async () => {
    const a = await productFrom('VFULFILL', 100);
    const order = await orderOf([{ product: a._id, name: a.name, price: 100, quantity: 1 }]);

    await ShopifyOrderPush.create({ order: order._id, supplier: 'VFULFILL', dueAt: new Date(), status: 'SCHEDULED' });
    await ShopifyOrderPush.create({
      order: order._id,
      supplier: 'DROPSHIP_INDIA',
      dueAt: new Date(),
      status: 'SCHEDULED',
    });
    expect(await orderPushService.isCancellable(order._id)).toBe(true);

    await ShopifyOrderPush.updateOne({ order: order._id, supplier: 'VFULFILL' }, { $set: { status: 'PUSHED' } });
    expect(await orderPushService.isCancellable(order._id)).toBe(false);
    expect(await orderPushService.claimForCancel({ orderId: order._id, cancelledBy: 'buyer' })).toBeNull();

    // And the untouched one stays schedulable rather than half-cancelled.
    const other = await ShopifyOrderPush.findOne({ order: order._id, supplier: 'DROPSHIP_INDIA' });
    expect(other.status).toBe('SCHEDULED');
  });
});

// ---------------------------------------------------------------------------
describe('the cancel window', () => {
  test('cancelling before it is sent wins, and stops the push', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({ order: order._id, dueAt: new Date(Date.now() + 60_000) });

    const claimed = await orderPushService.claimForCancel({ orderId: order._id, cancelledBy: 'buyer' });
    expect(claimed).not.toBeNull();
    expect(claimed.status).toBe('CANCELLED');

    // The cron can no longer pick it up.
    expect(await ShopifyOrderPush.claimNext(new Date(Date.now() + 120_000))).toBeNull();
  });

  test('cancelling loses once the cron has claimed it', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({ order: order._id, dueAt: new Date(Date.now() - 1000) });

    await ShopifyOrderPush.claimNext(); // the cron gets there first
    const claimed = await orderPushService.claimForCancel({ orderId: order._id, cancelledBy: 'buyer' });

    // Null means "already on its way" — the buyer is told to contact support
    // rather than being promised a cancellation that cannot happen.
    expect(claimed).toBeNull();
  });

  test('isCancellable reflects the push state', async () => {
    const order = await makeOrder();
    const push = await ShopifyOrderPush.create({ order: order._id, dueAt: new Date(Date.now() + 60_000) });
    expect(await orderPushService.isCancellable(order._id)).toBe(true);

    push.status = 'PUSHED';
    await push.save();
    expect(await orderPushService.isCancellable(order._id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('pushing', () => {
  async function claimedPush(order) {
    await ShopifyOrderPush.create({ order: order._id, dueAt: new Date(Date.now() - 1000) });
    return ShopifyOrderPush.claimNext();
  }

  test('a successful push records the Shopify order', async () => {
    const order = await makeOrder();
    jest
      .spyOn(shopifyOrderService, 'createOrder')
      .mockResolvedValue({ id: 'gid://shopify/Order/1', name: '#1001' });

    const result = await orderPushService.pushOne(await claimedPush(order));
    expect(result.outcome).toBe('pushed');

    const row = await ShopifyOrderPush.findOne({ order: order._id });
    expect(row.status).toBe('PUSHED');
    expect(row.shopifyOrderId).toBe('gid://shopify/Order/1');
    expect(row.pushedAt).toBeTruthy();
  });

  // A 5xx is treated as AMBIGUOUS, not as a clean failure: a 502 or 504 from
  // a gateway can mean the order was created and only the response was lost.
  // Reconciling costs a two-minute delay; guessing wrong costs a second
  // supplier order.
  test('a 5xx is parked for reconciliation rather than blindly resent', async () => {
    const order = await makeOrder();
    const err = new Error('Shopify returned 503');
    err.code = 'UPSTREAM';
    jest.spyOn(shopifyOrderService, 'createOrder').mockRejectedValue(err);

    const result = await orderPushService.pushOne(await claimedPush(order));
    expect(result.outcome).toBe('reconcile');

    const row = await ShopifyOrderPush.findOne({ order: order._id });
    expect(row.status).toBe('NEEDS_RECONCILE');
    expect(row.awaitingReconcile).toBe(true);
    expect(row.lastErrorCode).toBe('UPSTREAM');
  });

  test('a rejection is permanent and is not retried', async () => {
    const order = await makeOrder();
    const err = new Error('variant does not exist');
    err.code = 'ORDER_REJECTED';
    jest.spyOn(shopifyOrderService, 'createOrder').mockRejectedValue(err);

    const result = await orderPushService.pushOne(await claimedPush(order));
    expect(result.outcome).toBe('failed');
    expect((await ShopifyOrderPush.findOne({ order: order._id })).status).toBe('FAILED');
  });

  // orderCreate cannot be made idempotent, so a timed-out attempt that
  // actually succeeded must be ADOPTED, never sent again.
  test('a retry adopts an order the previous attempt already created', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({ order: order._id, dueAt: new Date(Date.now() - 1000), attempts: 1 });
    const push = await ShopifyOrderPush.claimNext(); // attempts -> 2

    const create = jest.spyOn(shopifyOrderService, 'createOrder');
    jest
      .spyOn(shopifyOrderService, 'findExistingOrder')
      .mockResolvedValue({ id: 'gid://shopify/Order/9', name: '#1009' });

    const result = await orderPushService.pushOne(push);
    expect(result.outcome).toBe('adopted');
    // The decisive assertion: no second order was created.
    expect(create).not.toHaveBeenCalled();
    expect((await ShopifyOrderPush.findOne({ order: order._id })).shopifyOrderId).toBe('gid://shopify/Order/9');
  });

  // THE most important property in this file. A timeout means the request was
  // sent and no answer came back — Shopify may or may not hold an order. And
  // Shopify's order search index lags its writes by seconds (verified against
  // the live store), so looking immediately reports "no such order" for an
  // order that exists. Retrying on that answer bills the supplier twice.
  test('a timeout is parked for reconciliation, not retried', async () => {
    const order = await makeOrder();
    const err = new Error('Shopify request timed out');
    err.code = 'TIMEOUT';
    err.isTimeout = true;
    jest.spyOn(shopifyOrderService, 'createOrder').mockRejectedValue(err);

    const result = await orderPushService.pushOne(await claimedPush(order));
    expect(result.outcome).toBe('reconcile');

    const row = await ShopifyOrderPush.findOne({ order: order._id });
    expect(row.status).toBe('NEEDS_RECONCILE');
    // Parked far enough ahead that the search index will have caught up.
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });

  test('a parked push is not claimed until its reconcile time arrives', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      dueAt: new Date(Date.now() - 10_000),
      status: 'NEEDS_RECONCILE',
      nextAttemptAt: new Date(Date.now() + 60_000),
    });
    expect(await ShopifyOrderPush.claimNext()).toBeNull();
    expect(await ShopifyOrderPush.claimNext(new Date(Date.now() + 120_000))).not.toBeNull();
  });

  test('reconciling adopts the order the timed-out attempt actually created', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      dueAt: new Date(Date.now() - 10_000),
      status: 'NEEDS_RECONCILE',
      awaitingReconcile: true,
      nextAttemptAt: new Date(Date.now() - 1000),
    });
    const push = await ShopifyOrderPush.claimNext();

    const create = jest.spyOn(shopifyOrderService, 'createOrder');
    jest
      .spyOn(shopifyOrderService, 'findExistingOrder')
      .mockResolvedValue({ id: 'gid://shopify/Order/77', name: '#1077' });

    const result = await orderPushService.pushOne(push);
    expect(result.outcome).toBe('adopted');
    expect(create).not.toHaveBeenCalled(); // no second supplier order
  });

  test('reconciling sends it when the timed-out attempt really did not land', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      dueAt: new Date(Date.now() - 10_000),
      status: 'NEEDS_RECONCILE',
      awaitingReconcile: true,
      nextAttemptAt: new Date(Date.now() - 1000),
    });
    const push = await ShopifyOrderPush.claimNext();

    jest.spyOn(shopifyOrderService, 'findExistingOrder').mockResolvedValue(null);
    jest
      .spyOn(shopifyOrderService, 'createOrder')
      .mockResolvedValue({ id: 'gid://shopify/Order/78', name: '#1078' });

    const result = await orderPushService.pushOne(push);
    expect(result.outcome).toBe('pushed');
    expect((await ShopifyOrderPush.findOne({ order: order._id })).status).toBe('PUSHED');
  });

  // The live failure burned six attempts over an hour before being abandoned,
  // which buried the real message under "abandoned after 6 attempts". A
  // document Shopify rejects as invalid never becomes valid.
  test('a query Shopify rejects as invalid fails immediately, without retrying', async () => {
    const order = await makeOrder();
    const err = new Error('OrderCreateUpsertCustomerAttributesInput requires at least one of id, email');
    err.code = 'GRAPHQL_ERROR';
    jest.spyOn(shopifyOrderService, 'createOrder').mockRejectedValue(err);

    const result = await orderPushService.pushOne(await claimedPush(order));
    expect(result.outcome).toBe('failed');

    const row = await ShopifyOrderPush.findOne({ order: order._id });
    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(1);
    expect(row.lastError).toMatch(/requires at least one of id, email/);
  });

  test('a throttle IS retried, because it never executed', async () => {
    const order = await makeOrder();
    const err = new Error('rate limited');
    err.code = 'THROTTLED';
    jest.spyOn(shopifyOrderService, 'createOrder').mockRejectedValue(err);

    const result = await orderPushService.pushOne(await claimedPush(order));
    expect(result.outcome).toBe('retry');
    expect((await ShopifyOrderPush.findOne({ order: order._id })).status).toBe('SCHEDULED');
  });

  test('a buyer cannot cancel an order whose outcome is unknown', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      dueAt: new Date(),
      status: 'NEEDS_RECONCILE',
      nextAttemptAt: new Date(Date.now() + 60_000),
    });
    // The supplier may already hold it. Promising a cancellation that cannot
    // happen is worse than refusing one.
    expect(await orderPushService.isCancellable(order._id)).toBe(false);
    expect(await orderPushService.claimForCancel({ orderId: order._id, cancelledBy: 'buyer' })).toBeNull();
  });

  test('an order cancelled before the cron reached it is never sent', async () => {
    const order = await makeOrder({ status: 'CANCELLED' });
    const create = jest.spyOn(shopifyOrderService, 'createOrder');

    const result = await orderPushService.pushOne(await claimedPush(order));
    expect(result.outcome).toBe('order_cancelled');
    expect(create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('the Shopify order payload', () => {
  test('the address is mapped, with the state turned into a province code', () => {
    const address = shopifyOrderService.buildAddress(ADDRESS);
    expect(address).toMatchObject({
      firstName: 'Asha',
      lastName: 'Menon',
      address1: '12 MG Road',
      city: 'Pune',
      provinceCode: 'MH',
      zip: '411001',
      countryCode: 'IN',
    });
  });

  // THE WORST FAILURE FOUND IN THIS INTEGRATION. Shopify ACCEPTS an order
  // whose lastName is empty and silently discards the entire shipping
  // address — so the order looks healthy and the supplier cannot deliver it.
  // Two real orders reached a supplier with no address before this was found.
  // Verified against the live API: any non-empty lastName keeps the address.
  test('lastName is never empty, whatever the buyer is called', () => {
    const { splitName } = shopifyOrderService;
    // A single-word name is extremely common in India.
    expect(splitName('Ankit').lastName).toBe('Ankit');
    expect(splitName('Ankit Ahirwar').lastName).toBe('Ahirwar');
    expect(splitName('Asha Devi Menon')).toEqual({ firstName: 'Asha Devi', lastName: 'Menon' });
    expect(splitName('').lastName).toBe('Customer');
    expect(splitName('   ').lastName).toBe('Customer');
    expect(splitName(null).lastName).toBe('Customer');
  });

  test('the address built for a single-word name carries a lastName', () => {
    const address = shopifyOrderService.buildAddress({ ...ADDRESS, fullName: 'Ankit' });
    expect(address.lastName).toBeTruthy();
    expect(address.address1).toBe('12 MG Road');
    expect(address.zip).toBe('411001');
  });

  test('an unrecognised state is omitted rather than guessed', () => {
    // A wrong province sends the parcel to the wrong end of the country; a
    // missing one is corrected by the PIN code beside it.
    const address = shopifyOrderService.buildAddress({ ...ADDRESS, state: 'Nowhereland' });
    expect(address.provinceCode).toBeUndefined();
    expect(address.zip).toBe('411001');
  });

  test('state names and codes both resolve', () => {
    expect(toProvinceCode('Maharashtra')).toBe('MH');
    expect(toProvinceCode('maharashtra')).toBe('MH');
    expect(toProvinceCode('MH')).toBe('MH');
    expect(toProvinceCode('Tamil Nadu')).toBe('TN');
    expect(toProvinceCode('Delhi')).toBe('DL');
    expect(toProvinceCode('')).toBeNull();
    expect(toProvinceCode('Atlantis')).toBeNull();
  });

  test('a line whose variant cannot be resolved aborts the whole push', async () => {
    const category = await createCategory();
    const product = await createProduct({ category: category._id, price: 100 });
    // A mapping with variants but no match for the requested variantId.
    await ProductFulfillmentMapping.create({
      product: product._id,
      provider: 'SHOPIFY',
      externalProductId: `gid://shopify/Product/${Date.now()}`,
      variants: [
        { krozendaVariantId: new mongoose.Types.ObjectId(), externalVariantId: 'gid://shopify/ProductVariant/a' },
        { krozendaVariantId: new mongoose.Types.ObjectId(), externalVariantId: 'gid://shopify/ProductVariant/b' },
      ],
    });

    await expect(
      shopifyOrderService.buildLineItems({
        items: [
          { product: product._id, name: 'Thing', price: 100, quantity: 1, variantId: new mongoose.Types.ObjectId() },
        ],
      })
    ).rejects.toMatchObject({ code: 'VARIANT_UNRESOLVED' });
  });
});

// ---------------------------------------------------------------------------
// A live order failed six times with "OrderCreateUpsertCustomerAttributesInput
// requires at least one of id, email". Shopify's customer upsert needs an id
// or an EMAIL — a phone is not enough — and Krozenda's buyers sign in by
// mobile OTP, so most have no email at all. Sending the block regardless took
// the whole order down with it.
describe('the customer sent to Shopify', () => {
  const { buildCustomer } = require('../services/shopify/shopifyOrderService');
  const order = { shippingAddress: { fullName: 'Asha Menon', phone: '9876543210' } };

  test('an email-less buyer sends no customer block at all', () => {
    expect(buildCustomer(order, { name: 'Asha Menon', mobileNumber: '9876543210' })).toBeNull();
    expect(buildCustomer(order, {})).toBeNull();
    expect(buildCustomer(order, null)).toBeNull();
  });

  test('a buyer with an email is upserted, with the phone normalised to E.164', () => {
    const customer = buildCustomer(order, { name: 'Asha Menon', email: 'asha@example.com', mobileNumber: '9876543210' });
    expect(customer.toUpsert).toMatchObject({
      firstName: 'Asha',
      lastName: 'Menon',
      email: 'asha@example.com',
      phone: '+919876543210',
    });
  });

  test('a phone already in E.164 is left alone', () => {
    const customer = buildCustomer(
      { shippingAddress: { fullName: 'A B', phone: '+919876543210' } },
      { email: 'a@b.com' }
    );
    expect(customer.toUpsert.phone).toBe('+919876543210');
  });

  // Nothing is lost by omitting the customer: the address and phone travel on
  // the order itself, which is what the supplier needs to deliver and to call.
  test('the order still carries the address and phone without a customer', async () => {
    const address = require('../services/shopify/shopifyOrderService').buildAddress(ADDRESS);
    expect(address.phone).toBe('9876543210');
    expect(address.address1).toBe('12 MG Road');
  });
});

// ---------------------------------------------------------------------------
// A live order was rejected with a flat "Order tags is invalid". Shopify caps
// a tag at 40 characters and refuses the WHOLE order if one is longer. The
// pre-split tag was 39 — under by one character, which is why it worked —
// and appending the supplier name took it to 54.
describe('Shopify tag limits', () => {
  const { orderTag, assertTagsValid, MAX_TAG_LENGTH } = require('../services/shopify/shopifyOrderService');
  const id = '6acdc6a1e55156a6705475ba'; // a real 24-character ObjectId

  test('every tag stays inside the 40-character cap', () => {
    expect(orderTag(id).length).toBeLessThanOrEqual(MAX_TAG_LENGTH);
    expect(orderTag(id, 'DROPSHIP_INDIA').length).toBeLessThanOrEqual(MAX_TAG_LENGTH);
    expect(orderTag(id, 'VFULFILL').length).toBeLessThanOrEqual(MAX_TAG_LENGTH);
  });

  test('an unknown supplier still produces a short tag', () => {
    // Falls back to the first two letters rather than the whole name, so a
    // long supplier name cannot blow the cap.
    expect(orderTag(id, 'SOME_VERY_LONG_SUPPLIER_NAME').length).toBeLessThanOrEqual(MAX_TAG_LENGTH);
  });

  test('the supplier tag differs from the order tag', () => {
    // Or the duplicate check would find vFulfill's order and conclude Dropship
    // India's had already been created, leaving one supplier never asked to ship.
    expect(orderTag(id, 'VFULFILL')).not.toBe(orderTag(id, 'DROPSHIP_INDIA'));
    expect(orderTag(id, 'VFULFILL')).not.toBe(orderTag(id));
  });

  test('an over-long tag is refused locally, with a message that says why', () => {
    expect(() => assertTagsValid(['x'.repeat(41)])).toThrow(/limited to 40 characters/);
    expect(() => assertTagsValid(['ok', orderTag(id, 'VFULFILL')])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe('what the buyer apps are told', () => {
  test("a SHOPIFY order is reported as STANDARD, because the apps' schemas enumerate it", () => {
    expect(buyerFulfillmentType({ fulfillmentType: 'SHOPIFY' })).toBe('STANDARD');
    expect(buyerFulfillmentType({ fulfillmentType: 'STANDARD' })).toBe('STANDARD');
    expect(buyerFulfillmentType({})).toBe('STANDARD');
  });

  // isDropship renders "cannot be cancelled, returned or replaced" in the
  // apps. With a real cancel window and real returns that is simply false.
  test('isDropship is false for a Shopify order', () => {
    expect(buyerIsDropship({ fulfillmentType: 'SHOPIFY' })).toBe(false);
    expect(buyerIsDropship({ fulfillmentType: 'DROPSHIP' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shopify cannot reach a private address, and a webhook it cannot deliver is
// dropped after it gives up retrying — silently. Catching a bad URL at
// registration is the only point where it is still visible.
describe('webhook callback validation', () => {
  const { callbackUrl } = require('../services/shopify/webhookRegistrationService');

  test('a public HTTPS address is accepted and gets the right path', () => {
    expect(callbackUrl('https://api.krozenda.com')).toBe('https://api.krozenda.com/webhook/shopify');
    expect(callbackUrl('https://api.krozenda.com/')).toBe('https://api.krozenda.com/webhook/shopify');
  });

  test('plain HTTP is refused', () => {
    expect(() => callbackUrl('http://api.krozenda.com')).toThrow(/HTTPS/i);
  });

  test('addresses Shopify cannot reach are refused', () => {
    expect(() => callbackUrl('https://localhost:5000')).toThrow(/cannot reach/i);
    expect(() => callbackUrl('https://127.0.0.1')).toThrow(/cannot reach/i);
  });
});

// ---------------------------------------------------------------------------
// Without this the stock figure taken at import never changes, and the
// product oversells the moment the supplier runs out.
describe('stock mirroring', () => {
  const { applyStock } = require('../services/shopify/inboundCatalogSync');

  test('a simple product takes the provider quantity', () => {
    const product = { stock: 10, variants: [] };
    const mapping = { variants: [{ externalVariantId: 'v1', externalInventoryItemId: 'i1' }] };
    expect(applyStock(product, mapping, new Map([['v1', 3]]))).toBe(true);
    expect(product.stock).toBe(3);
  });

  test('quantities are SET, never added to', () => {
    // The provider's figure is the truth. Treating it as a delta would drift
    // further out of step on every single sync.
    const product = { stock: 10, variants: [] };
    const mapping = { variants: [{ externalVariantId: 'v1' }] };
    applyStock(product, mapping, new Map([['v1', 2]]));
    expect(product.stock).toBe(2);
  });

  test('a variant product rolls its product-level stock up from its variants', () => {
    const product = {
      stock: 0,
      variants: [
        { _id: 'a', stock: 0 },
        { _id: 'b', stock: 0 },
      ],
    };
    const mapping = {
      variants: [
        { krozendaVariantId: 'a', externalVariantId: 'v1' },
        { krozendaVariantId: 'b', externalVariantId: 'v2' },
      ],
    };
    applyStock(product, mapping, new Map([['v1', 4], ['v2', 6]]));
    expect(product.variants[0].stock).toBe(4);
    expect(product.variants[1].stock).toBe(6);
    // Or a buyer sees "in stock" on a product whose every option is sold out.
    expect(product.stock).toBe(10);
  });

  test('a negative quantity is floored at zero', () => {
    // Shopify reports oversold stock as negative; a negative would fail the
    // Product schema's `min: 0` and abort the whole sync.
    const product = { stock: 5, variants: [] };
    const mapping = { variants: [{ externalVariantId: 'v1' }] };
    applyStock(product, mapping, new Map([['v1', -3]]));
    expect(product.stock).toBe(0);
  });

  test('a variant Shopify did not report keeps its last known figure', () => {
    // Missing is not zero. Blanking stock on a partial response would take a
    // sellable product off sale for no reason.
    const product = { stock: 7, variants: [{ _id: 'a', stock: 7 }] };
    const mapping = { variants: [{ krozendaVariantId: 'a', externalVariantId: 'v1' }] };
    expect(applyStock(product, mapping, new Map())).toBe(false);
    expect(product.variants[0].stock).toBe(7);
  });
});

// ---------------------------------------------------------------------------
describe('status coming back from Shopify', () => {
  test('a fulfilment marks the lines shipped and records the tracking number', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      dueAt: new Date(),
      status: 'PUSHED',
      shopifyOrderId: 'gid://shopify/Order/55',
    });

    await inboundOrderSync.handleFulfillment({
      admin_graphql_api_id: 'gid://shopify/Order/55',
      status: 'success',
      tracking_number: 'TRK123',
      tracking_company: 'Delhivery',
    });

    const fresh = await Order.findById(order._id);
    expect(fresh.items[0].status).toBe('SHIPPED');
    expect(fresh.items[0].trackingNumber).toBe('TRK123');
    expect(fresh.items[0].courierName).toBe('Delhivery');
  });

  test('the same webhook twice changes nothing the second time', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      dueAt: new Date(),
      status: 'PUSHED',
      shopifyOrderId: 'gid://shopify/Order/56',
    });
    const payload = {
      admin_graphql_api_id: 'gid://shopify/Order/56',
      status: 'success',
      tracking_number: 'TRK999',
    };

    const first = await inboundOrderSync.handleFulfillment(payload);
    const second = await inboundOrderSync.handleFulfillment(payload);

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect((await Order.findById(order._id)).items[0].statusHistory.filter((h) => h.status === 'SHIPPED')).toHaveLength(1);
  });

  // A late "shipped" must never pull a delivered order backwards.
  test('status only moves forward', async () => {
    const order = await makeOrder();
    order.items[0].status = 'DELIVERED';
    await order.save();
    await ShopifyOrderPush.create({
      order: order._id,
      dueAt: new Date(),
      status: 'PUSHED',
      shopifyOrderId: 'gid://shopify/Order/57',
    });

    await inboundOrderSync.handleFulfillment({
      admin_graphql_api_id: 'gid://shopify/Order/57',
      status: 'success',
    });

    expect((await Order.findById(order._id)).items[0].status).toBe('DELIVERED');
  });

  test('a cancelled order is left alone', async () => {
    const order = await makeOrder({ status: 'CANCELLED' });
    await ShopifyOrderPush.create({
      order: order._id,
      dueAt: new Date(),
      status: 'PUSHED',
      shopifyOrderId: 'gid://shopify/Order/58',
    });

    const result = await inboundOrderSync.handleFulfillment({
      admin_graphql_api_id: 'gid://shopify/Order/58',
      status: 'success',
    });
    expect(result.handled).toBe(false);
  });

  // Webhooks need a public HTTPS address. A server on localhost, behind a
  // firewall, or between deploys receives none — and without polling the
  // buyer's order sits at PENDING while the parcel is already moving.
  test('polling brings Shopify status across when no webhook arrived', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      supplier: 'VFULFILL',
      dueAt: new Date(),
      status: 'PUSHED',
      shopifyOrderId: 'gid://shopify/Order/901',
    });

    jest.spyOn(shopifyOrderService, 'getOrderStatus').mockResolvedValue({
      id: 'gid://shopify/Order/901',
      name: '#901',
      displayFulfillmentStatus: 'IN_PROGRESS',
      fulfillments: [],
    });

    const summary = await inboundOrderSync.pollOpenOrders({ limit: 10 });
    expect(summary.checked).toBe(1);
    expect(summary.changed).toBe(1);
    expect((await Order.findById(order._id)).items[0].status).toBe('PROCESSING');
  });

  test('polling applies a tracking number from a fulfilment', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      supplier: 'VFULFILL',
      dueAt: new Date(),
      status: 'PUSHED',
      shopifyOrderId: 'gid://shopify/Order/902',
    });

    jest.spyOn(shopifyOrderService, 'getOrderStatus').mockResolvedValue({
      id: 'gid://shopify/Order/902',
      name: '#902',
      displayFulfillmentStatus: 'FULFILLED',
      fulfillments: [{ status: 'SUCCESS', trackingInfo: [{ number: 'TRK-POLL-1', company: 'Delhivery' }] }],
    });

    await inboundOrderSync.pollOpenOrders({ limit: 10 });
    const fresh = await Order.findById(order._id);
    expect(fresh.items[0].status).toBe('SHIPPED');
    expect(fresh.items[0].trackingNumber).toBe('TRK-POLL-1');
  });

  test('polling skips finished orders, so the work does not grow with history', async () => {
    const order = await makeOrder({ status: 'DELIVERED' });
    await ShopifyOrderPush.create({
      order: order._id,
      supplier: 'VFULFILL',
      dueAt: new Date(),
      status: 'PUSHED',
      shopifyOrderId: 'gid://shopify/Order/903',
    });
    const spy = jest.spyOn(shopifyOrderService, 'getOrderStatus');

    const summary = await inboundOrderSync.pollOpenOrders({ limit: 10 });
    expect(summary.skipped).toBe(1);
    expect(spy).not.toHaveBeenCalled();
  });

  // Polling and webhooks both run; whichever arrives second must be a no-op.
  test('polling after a webhook changes nothing', async () => {
    const order = await makeOrder();
    await ShopifyOrderPush.create({
      order: order._id,
      supplier: 'VFULFILL',
      dueAt: new Date(),
      status: 'PUSHED',
      shopifyOrderId: 'gid://shopify/Order/904',
    });

    await inboundOrderSync.handleFulfillment({
      admin_graphql_api_id: 'gid://shopify/Order/904',
      status: 'success',
      tracking_number: 'TRK-BOTH',
    });

    jest.spyOn(shopifyOrderService, 'getOrderStatus').mockResolvedValue({
      id: 'gid://shopify/Order/904',
      name: '#904',
      displayFulfillmentStatus: 'FULFILLED',
      fulfillments: [{ status: 'SUCCESS', trackingInfo: [{ number: 'TRK-BOTH', company: '' }] }],
    });

    const summary = await inboundOrderSync.pollOpenOrders({ limit: 10 });
    expect(summary.changed).toBe(0);
    const fresh = await Order.findById(order._id);
    expect(fresh.items[0].statusHistory.filter((h) => h.status === 'SHIPPED')).toHaveLength(1);
  });

  test('a webhook for an order we do not know is ignored, not thrown on', async () => {
    const result = await inboundOrderSync.handleFulfillment({
      admin_graphql_api_id: 'gid://shopify/Order/does-not-exist',
      status: 'success',
    });
    expect(result).toMatchObject({ handled: false, reason: 'UNKNOWN_ORDER' });
  });
});
