// Regression tests for the user-panel audit. Each block names the defect it
// locks down, so a later change that reintroduces one fails here rather than
// in production.
const request = require('supertest');
const app = require('../app');
const Cart = require('../Models/Cart');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const { signToken, signRefreshToken } = require('../utils/jwt');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createProduct,
  createAddress,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------
// Before: the client's axios interceptor called POST /auth/refresh-token on a
// 401, but no such route existed and login never issued a refresh token — so
// the refresh branch was dead code and every expiry silently signed the buyer
// out mid-action.
describe('refresh token', () => {
  it('login issues both an access and a refresh token', async () => {
    const mobileNumber = '9812345601';
    await request(app).post('/auth/send-otp').send({ mobileNumber });
    const res = await request(app).post('/auth/verify-otp').send({ mobileNumber, otp: '123456' });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('exchanges a refresh token for a working access token', async () => {
    const { user } = await createCustomer();
    const refreshToken = signRefreshToken('user', { id: user._id.toString(), role: 'customer' });

    const res = await request(app).post('/auth/refresh-token').send({ refreshToken });
    expect(res.status).toBe(200);

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(user._id.toString());
  });

  it('refuses a refresh token used as a bearer credential', async () => {
    const { user } = await createCustomer();
    const refreshToken = signRefreshToken('user', { id: user._id.toString(), role: 'customer' });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${refreshToken}`);
    expect(res.status).toBe(401);
  });

  it('refuses an access token presented to the refresh endpoint', async () => {
    const { token } = await createCustomer();
    const res = await request(app).post('/auth/refresh-token').send({ refreshToken: token });
    expect(res.status).toBe(401);
  });

  it('refuses to refresh a deactivated account', async () => {
    const { user } = await createCustomer();
    const refreshToken = signRefreshToken('user', { id: user._id.toString(), role: 'customer' });
    user.isActive = false;
    await user.save();

    const res = await request(app).post('/auth/refresh-token').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('labels an expired access token so the client knows to refresh', async () => {
    const { user } = await createCustomer();
    const expired = signToken(
      'user',
      { id: user._id.toString(), role: 'customer' },
      { expiresIn: '-1s' }
    );

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });
});

// ---------------------------------------------------------------------------
// Order idempotency
// ---------------------------------------------------------------------------
// Before: only the Razorpay path was protected (by the unique payment id).
// A double-tapped "Place Order" on COD created two real orders and reserved
// stock twice.
describe('order idempotency', () => {
  async function readyToCheckout() {
    const { user, token } = await createCustomer();
    const product = await createProduct({ price: 500, stock: 10 });
    const address = await createAddress(user._id);
    await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 2 }] });
    return { user, token, product, address };
  }

  it('a repeated COD submission with the same key creates exactly one order', async () => {
    const { user, token, product, address } = await readyToCheckout();
    const key = 'checkout-key-aaaaaaaa';

    const first = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD' });

    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await Order.countDocuments({ user: user._id })).toBe(1);

    // and the retry must not have decremented stock a second time
    const fresh = await Product.findById(product._id);
    expect(fresh.stock).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Checkout tells the truth about the cart
// ---------------------------------------------------------------------------
// Before: computeCheckoutTotals filtered deactivated products out of the cart
// and charged for whatever was left, so a buyer could agree to a 3-item total
// and be billed for 2 without being told.
describe('checkout rejects a cart it cannot fulfil', () => {
  it('refuses rather than quietly dropping a deactivated product', async () => {
    const { user, token } = await createCustomer();
    const good = await createProduct({ price: 500, stock: 10 });
    const gone = await createProduct({ price: 900, stock: 10, isActive: false });
    const address = await createAddress(user._id);
    await Cart.create({
      user: user._id,
      items: [
        { product: good._id, quantity: 1 },
        { product: gone._id, quantity: 1 },
      ],
    });

    const res = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CART_ITEM_UNAVAILABLE');
    expect(await Order.countDocuments({ user: user._id })).toBe(0);
  });

  it('refuses when a line asks for more than is in stock, and says how many are left', async () => {
    const { user, token } = await createCustomer();
    const product = await createProduct({ price: 500, stock: 2 });
    const address = await createAddress(user._id);
    await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 5 }] });

    const res = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.details.items[0]).toMatchObject({ requested: 5, available: 2 });
  });
});

// ---------------------------------------------------------------------------
// Catalog listing
// ---------------------------------------------------------------------------
describe('public product listing', () => {
  it('caps limit so ?limit=100000 cannot pull the catalog', async () => {
    const res = await request(app).get('/catalog/products').query({ limit: 100000 });
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(50);
  });

  it('survives a negative limit and a zero page', async () => {
    const res = await request(app).get('/catalog/products').query({ limit: -100, page: 0 });
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBeGreaterThanOrEqual(1);
  });

  it('answers a non-ObjectId category with an empty page, not a 500', async () => {
    const res = await request(app).get('/catalog/products').query({ category: 'shoes' });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('returns an empty page when min price exceeds max price', async () => {
    const res = await request(app).get('/catalog/products').query({ minPrice: 9000, maxPrice: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('omits description from listing rows but keeps it on the detail endpoint', async () => {
    const product = await createProduct({ description: 'A long marketing description.' });

    const list = await request(app).get('/catalog/products').query({ search: product.name });
    const row = list.body.data.items.find((p) => p.id === product._id.toString());
    expect(row).toBeDefined();
    expect(row.description).toBeUndefined();

    const detail = await request(app).get(`/catalog/products/${product._id}`);
    expect(detail.body.data.description).toBe('A long marketing description.');
  });

  it('never leaks vendor or moderation fields to a shopper', async () => {
    const product = await createProduct();
    const detail = await request(app).get(`/catalog/products/${product._id}`);

    expect(detail.status).toBe(200);
    expect(detail.body.data.vendor).toBeUndefined();
    expect(detail.body.data.approvalStatus).toBeUndefined();
    expect(detail.body.data.rejectionReason).toBeUndefined();
  });

  it('reports an empty flash sale as empty instead of substituting ordinary products', async () => {
    // A product exists, but none are flagged as flash-sale. The old fallback
    // returned the newest products anyway, which put full-price items under a
    // "Flash Sale" header.
    await createProduct({ isFlashsale: false });
    const res = await request(app).get('/catalog/products').query({ flashSale: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.data.items.every((p) => p.isFlashsale)).toBe(true);
  });

  it('excludes products still awaiting approval', async () => {
    const pending = await createProduct({ approvalStatus: 'PENDING' });
    const res = await request(app).get('/catalog/products').query({ search: pending.name });
    expect(res.body.data.items).toEqual([]);
  });

  it('never returns the product itself in its own related rail', async () => {
    const product = await createProduct();
    await createProduct({ category: product.category });

    const res = await request(app).get(`/catalog/products/${product._id}/related`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((p) => p.id === product._id.toString())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cart reports availability instead of hiding it
// ---------------------------------------------------------------------------
describe('cart', () => {
  it('flags a deactivated line rather than dropping it silently', async () => {
    const { user, token } = await createCustomer();
    const gone = await createProduct({ isActive: false });
    await Cart.create({ user: user._id, items: [{ product: gone._id, quantity: 1 }] });

    const res = await request(app).get('/user/cart').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].availability).toBe('UNAVAILABLE');
    expect(res.body.data.summary.hasIssues).toBe(true);
  });

  it('reports a low-stock line so the UI can warn before checkout', async () => {
    const { user, token } = await createCustomer();
    const scarce = await createProduct({ stock: 2 });
    await Cart.create({ user: user._id, items: [{ product: scarce._id, quantity: 1 }] });

    const res = await request(app).get('/user/cart').set('Authorization', `Bearer ${token}`);
    expect(res.body.data.items[0]).toMatchObject({ availability: 'LOW_STOCK', stock: 2 });
  });

  it('merges a guest cart additively and caps the result at real stock', async () => {
    const { user, token } = await createCustomer();
    const product = await createProduct({ stock: 4 });
    await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 3 }] });

    const res = await request(app)
      .post('/user/cart/merge')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), quantity: 2 }] });

    expect(res.status).toBe(200);
    // 3 already in the account + 2 from the guest session = 5, capped to 4.
    expect(res.body.data.items[0].quantity).toBe(4);
    expect(res.body.data.adjustments[0]).toMatchObject({ reason: 'STOCK_CAPPED', requested: 5, applied: 4 });
  });
});

// ---------------------------------------------------------------------------
// Authorization — one buyer must never reach another's resources
// ---------------------------------------------------------------------------
describe('object-level authorization', () => {
  it("refuses to serve another buyer's order by id", async () => {
    const { user: owner } = await createCustomer();
    const { token: attackerToken } = await createCustomer();
    const address = await createAddress(owner._id);
    const product = await createProduct();

    const order = await Order.create({
      user: owner._id,
      items: [{ product: product._id, name: product.name, price: 100, quantity: 1 }],
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      subtotal: 100,
      total: 100,
      paymentMethod: 'COD',
    });

    const res = await request(app)
      .get(`/user/orders/${order._id}`)
      .set('Authorization', `Bearer ${attackerToken}`);
    expect(res.status).toBe(404);
  });

  it("refuses to cancel another buyer's order", async () => {
    const { user: owner } = await createCustomer();
    const { token: attackerToken } = await createCustomer();
    const product = await createProduct();

    const order = await Order.create({
      user: owner._id,
      items: [{ product: product._id, name: product.name, price: 100, quantity: 1 }],
      shippingAddress: {
        fullName: 'X',
        phone: '9999999999',
        line1: 'L1',
        city: 'C',
        state: 'S',
        pincode: '123456',
      },
      subtotal: 100,
      total: 100,
      paymentMethod: 'COD',
      status: 'PENDING',
    });

    const res = await request(app)
      .patch(`/user/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${attackerToken}`);
    expect(res.status).toBe(404);

    const fresh = await Order.findById(order._id);
    expect(fresh.status).toBe('PENDING');
  });
});

// ---------------------------------------------------------------------------
// Pagination is applied everywhere a list can grow
// ---------------------------------------------------------------------------
describe('list endpoints are bounded', () => {
  it('paginates orders and returns lightweight summaries', async () => {
    const { user, token } = await createCustomer();
    const product = await createProduct();

    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Order.create({
        user: user._id,
        items: [{ product: product._id, name: product.name, price: 100, quantity: 1 }],
        shippingAddress: { fullName: 'X', phone: '9999999999', line1: 'L1', city: 'C', state: 'S', pincode: '123456' },
        subtotal: 100,
        total: 100,
        paymentMethod: 'COD',
      });
    }

    const res = await request(app)
      .get('/user/orders')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2, total: 3, hasNextPage: true });
    // a summary row carries no shipping address / status history
    expect(res.body.data.items[0].shippingAddress).toBeUndefined();
    expect(res.body.data.items[0].itemCount).toBe(1);
  });

  it('paginates notifications and reports an unread count', async () => {
    const { token } = await createCustomer();
    const res = await request(app)
      .get('/user/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20 });
    expect(typeof res.body.data.unreadCount).toBe('number');
  });

  it('paginates the wishlist', async () => {
    const { token } = await createCustomer();
    const res = await request(app).get('/user/wishlist').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20 });
  });
});
