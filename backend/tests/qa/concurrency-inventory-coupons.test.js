// QA audit — concurrency: hot-product stock races, coupon usage caps,
// double-submitted checkouts, cancellation replays.
//
// Every race here is real parallelism against the replica-set test mongod
// (Promise.all over supertest), not a simulated interleaving.

jest.mock('../../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const Order = require('../../Models/Order');
const Product = require('../../Models/Product');
const Coupon = require('../../Models/Coupon');
const Customer = require('../../Models/Customer');
const {
  connectTestDb,
  disconnectTestDb,
  createProduct,
  buyerWithAddress,
  addToCart,
  placeCod,
  as,
  knownBug,
} = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

async function buyersWithItemInCart(n, productId, quantity = 1, extra = {}) {
  const buyers = [];
  for (let i = 0; i < n; i += 1) {
    const b = await buyerWithAddress();
    const add = await addToCart(b.token, productId, quantity, extra);
    expect(add.status).toBeLessThan(300);
    buyers.push(b);
  }
  return buyers;
}

describe('hot product: 20 buyers, 3 units', () => {
  test('exactly 3 orders succeed, the rest get 409, stock ends at 0 — never negative', async () => {
    const product = await createProduct({ stock: 3, price: 499 });
    const buyers = await buyersWithItemInCart(20, product._id);

    const results = await Promise.all(buyers.map((b) => placeCod(b.token, b.address._id)));
    const statuses = results.map((r) => r.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    expect(statuses.filter((s) => s === 409)).toHaveLength(17);
    expect((await Product.findById(product._id)).stock).toBe(0);
    expect(await Order.countDocuments({ 'items.product': product._id })).toBe(3);
  });

  test('multi-unit lines: 10 buyers × 2 units against stock 5 → 2 orders, 1 unit left', async () => {
    const product = await createProduct({ stock: 5, price: 100 });
    const buyers = await buyersWithItemInCart(10, product._id, 2);
    const results = await Promise.all(buyers.map((b) => placeCod(b.token, b.address._id)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect((await Product.findById(product._id)).stock).toBe(1);
  });

  test('variant stock race is per-variant: last Red unit sells once while Blue is unaffected', async () => {
    const product = await createProduct({
      stock: 0,
      price: 300,
      variants: [
        { name: 'Red', sku: `QA-R-${Date.now()}`, price: 300, stock: 1 },
        { name: 'Blue', sku: `QA-B-${Date.now()}`, price: 300, stock: 5 },
      ],
    });
    const red = product.variants.find((v) => v.name === 'Red');
    const buyers = await buyersWithItemInCart(8, product._id, 1, { variantId: String(red._id) });
    const results = await Promise.all(buyers.map((b) => placeCod(b.token, b.address._id)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const fresh = await Product.findById(product._id);
    expect(fresh.variants.find((v) => v.name === 'Red').stock).toBe(0);
    expect(fresh.variants.find((v) => v.name === 'Blue').stock).toBe(5);
  });

  test('a failed line in a multi-line cart releases the lines it had already reserved', async () => {
    const plenty = await createProduct({ stock: 10, price: 50 });
    const scarce = await createProduct({ stock: 1, price: 50 });
    const [b1, b2] = [await buyerWithAddress(), await buyerWithAddress()];
    for (const b of [b1, b2]) {
      await addToCart(b.token, plenty._id, 2);
      await addToCart(b.token, scarce._id, 1);
    }
    const results = await Promise.all([b1, b2].map((b) => placeCod(b.token, b.address._id)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await Product.findById(plenty._id)).stock).toBe(8); // only the winner's 2
    expect((await Product.findById(scarce._id)).stock).toBe(0);
  });
});

describe('cart quantity normalisation', () => {
  // By design the cart does not 400 on a bad quantity: it normalises to a
  // whole number ≥ 1 and clamps to stock (cartController.addCartItem). What
  // must hold is that nothing outside [1, stock] is ever stored.
  test.each([
    ['zero', 0, 1],
    ['negative', -3, 1],
    ['fractional', 1.5, 2],
    ['string', 'abc', 1],
    ['huge', 1e9, 10],
    ['object', { $gt: 0 }, 1],
  ])('a %s quantity is stored as a whole number within stock', async (_label, quantity, expected) => {
    const Cart = require('../../Models/Cart');
    const product = await createProduct({ stock: 10 });
    const b = await buyerWithAddress();
    const res = await addToCart(b.token, product._id, quantity);
    expect(res.status).toBe(200);
    const cart = await Cart.findOne({ user: b.user._id });
    expect(cart.items[0].quantity).toBe(expected);
  });

  test('a malformed product id is a 400, not a 500', async () => {
    const b = await buyerWithAddress();
    const res = await addToCart(b.token, 'not-an-id', 1);
    expect(res.status).toBe(400);
  });
});

describe('double-submitted checkout', () => {
  test('with the same Idempotency-Key, 5 parallel submits make exactly one order', async () => {
    const product = await createProduct({ stock: 10, price: 200 });
    const b = await buyerWithAddress();
    await addToCart(b.token, product._id, 1);
    const key = `qa-${Date.now()}-abcdef`;
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        as(b.token).post('/user/orders', { addressId: String(b.address._id), paymentMethod: 'COD', idempotencyKey: key })
      )
    );
    expect(results.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(await Order.countDocuments({ user: b.user._id })).toBe(1);
    expect((await Product.findById(product._id)).stock).toBe(9);
  });

  test('QA-012 (regression): without an Idempotency-Key, a 4× double-tap places the cart once and stock moves once', async () => {
    const product = await createProduct({ stock: 10, price: 200 });
    const b = await buyerWithAddress();
    await addToCart(b.token, product._id, 1);
    const results = await Promise.all(Array.from({ length: 4 }, () => placeCod(b.token, b.address._id)));
    expect(results.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
    expect(await Order.countDocuments({ user: b.user._id })).toBe(1);
    expect((await Product.findById(product._id)).stock).toBe(9);
  });

  test('QA-012: the same cart bought again after the double-tap window is a new order', async () => {
    const product = await createProduct({ stock: 10, price: 200 });
    const b = await buyerWithAddress();
    await addToCart(b.token, product._id, 1);
    expect((await placeCod(b.token, b.address._id)).status).toBe(201);
    await addToCart(b.token, product._id, 1);
    const realNow = Date.now;
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 31 * 1000);
    try {
      expect((await placeCod(b.token, b.address._id)).status).toBe(201);
    } finally {
      spy.mockRestore();
    }
    expect(await Order.countDocuments({ user: b.user._id })).toBe(2);
  });

  test('QA-012: a different cart from the same buyer is never mistaken for a double tap', async () => {
    const [p1, p2] = [await createProduct({ stock: 10 }), await createProduct({ stock: 10 })];
    const b = await buyerWithAddress();
    await addToCart(b.token, p1._id, 1);
    expect((await placeCod(b.token, b.address._id)).status).toBe(201);
    await addToCart(b.token, p2._id, 1);
    expect((await placeCod(b.token, b.address._id)).status).toBe(201);
    expect(await Order.countDocuments({ user: b.user._id })).toBe(2);
  });
});

describe('coupon usage caps under concurrency', () => {
  async function coupon(overrides) {
    return Coupon.create({
      code: `QARACE${Date.now()}${Math.floor(Math.random() * 1e4)}`,
      discountType: 'FIXED',
      discountValue: 100,
      applicableTo: 'ALL',
      startDate: new Date(Date.now() - 1000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
      ...overrides,
    });
  }

  test('sequential: a usageLimit-1 coupon works once, then is refused', async () => {
    const c = await coupon({ usageLimit: 1 });
    const product = await createProduct({ stock: 10, price: 1000 });
    const [b1, b2] = await buyersWithItemInCart(2, product._id);
    expect((await placeCod(b1.token, b1.address._id, { couponCode: c.code })).status).toBe(201);
    const second = await placeCod(b2.token, b2.address._id, { couponCode: c.code });
    expect(second.status).toBe(400);
  });

  test('QA-006a (regression): a usageLimit-1 coupon raced by 8 buyers discounts exactly one order', async () => {
    const c = await coupon({ usageLimit: 1 });
    const product = await createProduct({ stock: 50, price: 1000 });
    const buyers = await buyersWithItemInCart(8, product._id);
    await Promise.all(buyers.map((b) => placeCod(b.token, b.address._id, { couponCode: c.code })));
    const discounted = await Order.countDocuments({ couponCode: c.code, discountAmount: { $gt: 0 } });
    expect(discounted).toBe(1);
  });

  test('QA-006b (regression): a perUserLimit-1 coupon raced by ONE buyer (two tabs) discounts one order', async () => {
    const c = await coupon({ perUserLimit: 1 });
    const product = await createProduct({ stock: 50, price: 1000 });
    const b = await buyerWithAddress();
    await addToCart(b.token, product._id, 1);
    // two distinct keys = two genuine checkouts from the same cart
    await Promise.all(
      ['k1', 'k2'].map((k) =>
        as(b.token).post('/user/orders', {
          addressId: String(b.address._id),
          paymentMethod: 'COD',
          couponCode: c.code,
          idempotencyKey: `qa-${k}-${Date.now()}-xyz`,
        })
      )
    );
    expect(await Order.countDocuments({ user: b.user._id, discountAmount: { $gt: 0 } })).toBeLessThanOrEqual(1);
  });
});

describe('coupon hold is released when the checkout fails', () => {
  test('stock-out after redemption gives the coupon slot back', async () => {
    const c = await Coupon.create({
      code: `QAREL${Date.now()}`,
      discountType: 'FIXED',
      discountValue: 50,
      applicableTo: 'ALL',
      usageLimit: 1,
      startDate: new Date(Date.now() - 1000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });
    const product = await createProduct({ stock: 1, price: 500 });
    const [a, b] = [await buyerWithAddress(), await buyerWithAddress()];
    await addToCart(a.token, product._id, 1);
    // stock gone between cart and checkout
    await Product.updateOne({ _id: product._id }, { $set: { stock: 0 } });
    // cart still says 1, so checkout reaches redemption and then fails on stock
    const failed = await placeCod(a.token, a.address._id, { couponCode: c.code });
    expect(failed.status).toBe(409);
    expect((await Coupon.findById(c._id)).usedCount).toBe(0);

    await Product.updateOne({ _id: product._id }, { $set: { stock: 5 } });
    await addToCart(b.token, product._id, 1);
    expect((await placeCod(b.token, b.address._id, { couponCode: c.code })).status).toBe(201);
    expect((await Coupon.findById(c._id)).usedCount).toBe(1);
  });

  test('wallet shortfall after redemption gives the coupon slot back', async () => {
    const c = await Coupon.create({
      code: `QAWAL${Date.now()}`,
      discountType: 'FIXED',
      discountValue: 50,
      applicableTo: 'ALL',
      usageLimit: 1,
      startDate: new Date(Date.now() - 1000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });
    const product = await createProduct({ stock: 5, price: 500 });
    const b = await buyerWithAddress({ walletBalance: 10 });
    await addToCart(b.token, product._id, 1);
    const res = await as(b.token).post('/user/orders', { addressId: String(b.address._id), paymentMethod: 'WALLET', couponCode: c.code });
    expect(res.status).toBe(400);
    expect((await Coupon.findById(c._id)).usedCount).toBe(0);
    expect((await Product.findById(product._id)).stock).toBe(5);
  });
});

describe('cancellation replay', () => {
  test('cancelling the same paid order 5× in parallel refunds and restocks exactly once', async () => {
    const product = await createProduct({ stock: 5, price: 700, gstRate: 0 });
    const b = await buyerWithAddress({ walletBalance: 5000 });
    await addToCart(b.token, product._id, 2);
    const placed = await as(b.token).post('/user/orders', { addressId: String(b.address._id), paymentMethod: 'WALLET' });
    expect(placed.status).toBe(201);
    const total = placed.body.data.total;
    const id = placed.body.data.id;
    const walletAfterOrder = (await Customer.findById(b.user._id)).walletBalance;
    expect(walletAfterOrder).toBeCloseTo(5000 - total, 2);

    const results = await Promise.all(Array.from({ length: 5 }, () => as(b.token).patch(`/user/orders/${id}/cancel`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await Product.findById(product._id)).stock).toBe(5);
    expect((await Customer.findById(b.user._id)).walletBalance).toBeCloseTo(5000, 2);
  });

  test('a buyer cannot cancel someone else’s order', async () => {
    const product = await createProduct({ stock: 5 });
    const owner = await buyerWithAddress();
    const other = await buyerWithAddress();
    await addToCart(owner.token, product._id, 1);
    const placed = await placeCod(owner.token, owner.address._id);
    const res = await as(other.token).patch(`/user/orders/${placed.body.data.id}/cancel`);
    expect(res.status).toBe(404);
    expect((await Order.findById(placed.body.data.id)).status).toBe('PENDING');
  });
});
