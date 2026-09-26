jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const razorpay = require('../Config/razorpay');
const Product = require('../Models/Product');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createProduct,
  createAddress,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.clearAllMocks());

async function addToCart(token, productId, quantity = 1) {
  return request(app)
    .post('/user/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity });
}

// The delivery address must belong to the same account placing the order —
// createOrder looks it up as Address.findOne({_id, user: req.user._id}).
async function buyerWithAddress() {
  const { user, token } = await createCustomer();
  const address = await createAddress(user._id);
  return { user, token, address };
}

describe('COD checkout — stock reservation', () => {
  it('atomically decrements stock on order creation', async () => {
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ stock: 3, price: 500 });

    await addToCart(token, product._id.toString(), 2);

    const res = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD', shippingFee: 0 });

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(1000);

    const fresh = await Product.findById(product._id);
    expect(fresh.stock).toBe(1);
  });

  it('rejects checkout when stock runs out and restores nothing extra', async () => {
    const buyerA = await buyerWithAddress();
    const buyerB = await buyerWithAddress();
    const product = await createProduct({ stock: 1, price: 200 });

    // Both buyers add the last unit to their own cart — cart itself allows
    // it (each cart independently sees stock=1 at add-time); the race is
    // decided atomically at order creation.
    await addToCart(buyerA.token, product._id.toString(), 1);
    await addToCart(buyerB.token, product._id.toString(), 1);

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/user/orders')
        .set('Authorization', `Bearer ${buyerA.token}`)
        .send({ addressId: buyerA.address._id.toString(), paymentMethod: 'COD', shippingFee: 0 }),
      request(app)
        .post('/user/orders')
        .set('Authorization', `Bearer ${buyerB.token}`)
        .send({ addressId: buyerB.address._id.toString(), paymentMethod: 'COD', shippingFee: 0 }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const fresh = await Product.findById(product._id);
    expect(fresh.stock).toBe(0);
  });
});

describe('order cancellation', () => {
  it('lets a user cancel their own PENDING order and restores stock', async () => {
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ stock: 5, price: 100 });
    await addToCart(token, product._id.toString(), 1);

    const order = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD', shippingFee: 0 });

    const cancel = await request(app)
      .patch(`/user/orders/${order.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);

    const fresh = await Product.findById(product._id);
    expect(fresh.stock).toBe(5);

    const cancelAgain = await request(app)
      .patch(`/user/orders/${order.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelAgain.status).toBe(400);
  });

  it('user A cannot cancel user B\'s order (IDOR)', async () => {
    const { token: tokenA } = await createCustomer();
    const { token: tokenB, address } = await buyerWithAddress();
    const product = await createProduct({ stock: 5, price: 100 });
    await addToCart(tokenB, product._id.toString(), 1);

    const order = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD', shippingFee: 0 });

    const res = await request(app)
      .patch(`/user/orders/${order.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });
});

describe('admin order status transitions', () => {
  it('rejects an invalid jump (PENDING -> DELIVERED)', async () => {
    const { token: adminToken } = await createAdmin();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ stock: 5, price: 100 });
    await addToCart(token, product._id.toString(), 1);

    const order = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD', shippingFee: 0 });

    const res = await request(app)
      .patch(`/admin/orders/${order.body.data.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DELIVERED' });
    expect(res.status).toBe(400);
  });

  it('allows the correct sequential progression', async () => {
    const { token: adminToken } = await createAdmin();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ stock: 5, price: 100 });
    await addToCart(token, product._id.toString(), 1);

    const order = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD', shippingFee: 0 });
    const id = order.body.data.id;

    for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
      const res = await request(app)
        .patch(`/admin/orders/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
  });
});

describe('Razorpay payment amount verification (regression for pay-1-checkout-50000)', () => {
  it('rejects an order when the captured payment amount does not match the server-computed total', async () => {
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ stock: 5, price: 50000 });
    await addToCart(token, product._id.toString(), 1);

    // Simulate: attacker created/paid a Razorpay order for ₹1 elsewhere,
    // then submits that valid (order,payment,signature) triple against a
    // cart that actually totals ₹50,000.
    const razorpayOrderId = 'order_fake123';
    const razorpayPaymentId = 'pay_fake123';
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    razorpay.payments.fetch.mockResolvedValue({
      order_id: razorpayOrderId,
      status: 'captured',
      amount: 100, // ₹1 in paise — far below the real ₹50,000 total
    });

    const res = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        addressId: address._id.toString(),
        paymentMethod: 'RAZORPAY',
        shippingFee: 0,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature,
      });

    expect(res.status).toBe(400);

    const fresh = await Product.findById(product._id);
    expect(fresh.stock).toBe(5); // untouched — order was never created
  });

  it('accepts the order once the captured amount genuinely matches the total', async () => {
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ stock: 5, price: 2000 });
    await addToCart(token, product._id.toString(), 1);

    const razorpayOrderId = 'order_real123';
    const razorpayPaymentId = 'pay_real123';
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    razorpay.payments.fetch.mockResolvedValue({
      order_id: razorpayOrderId,
      status: 'captured',
      amount: 200000, // ₹2000 in paise — matches the real total exactly
    });

    const res = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        addressId: address._id.toString(),
        paymentMethod: 'RAZORPAY',
        shippingFee: 0,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.paymentStatus).toBe('PAID');
  });

  it('rejects replaying the same payment id for a second order', async () => {
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ stock: 5, price: 1500 });
    await addToCart(token, product._id.toString(), 1);

    const razorpayOrderId = 'order_replay1';
    const razorpayPaymentId = 'pay_replay1';
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    razorpay.payments.fetch.mockResolvedValue({
      order_id: razorpayOrderId,
      status: 'captured',
      amount: 150000,
    });

    const payload = {
      addressId: address._id.toString(),
      paymentMethod: 'RAZORPAY',
      shippingFee: 0,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: signature,
    };

    const first = await request(app).post('/user/orders').set('Authorization', `Bearer ${token}`).send(payload);
    expect(first.status).toBe(201);

    await addToCart(token, product._id.toString(), 1);
    const second = await request(app).post('/user/orders').set('Authorization', `Bearer ${token}`).send(payload);
    expect(second.status).toBe(409);
  });
});

describe('COD paid on delivery', () => {
  it('marks a COD order PAID when admin moves it to DELIVERED', async () => {
    const { token, address } = await buyerWithAddress();
    const { token: adminToken } = await createAdmin();
    const product = await createProduct({ stock: 5, price: 300 });
    await addToCart(token, product._id.toString(), 1);

    const placed = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD' });
    expect(placed.status).toBe(201);
    const orderId = placed.body.data.id;
    expect(placed.body.data.paymentStatus).toBe('PENDING');

    for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
      const res = await request(app)
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status });
      expect(res.status).toBe(200);
    }

    const Order = require('../Models/Order');
    const order = await Order.findById(orderId).lean();
    expect(order.status).toBe('DELIVERED');
    expect(order.paymentStatus).toBe('PAID');
    // Remittance is still its own step.
    expect(order.codRemittedAt).toBeNull();
  });

  it('marks a COD order PAID when its last line is delivered and the order is saved', async () => {
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ stock: 5, price: 300 });
    await addToCart(token, product._id.toString(), 1);
    const placed = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD' });

    const Order = require('../Models/Order');
    const order = await Order.findById(placed.body.data.id);
    order.items.forEach((item) => {
      item.status = 'DELIVERED';
    });
    await order.save();

    const fresh = await Order.findById(order._id).lean();
    expect(fresh.paymentStatus).toBe('PAID');
  });
});

describe('buyer order canReturn', () => {
  async function deliveredOrderFor(productOverrides) {
    const { token, address } = await buyerWithAddress();
    const { token: adminToken } = await createAdmin();
    const product = await createProduct({ stock: 5, price: 300, ...productOverrides });
    await addToCart(token, product._id.toString(), 1);
    const placed = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD' });
    const orderId = placed.body.data.id;
    for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
      await request(app)
        .patch(`/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status });
    }
    const res = await request(app).get(`/user/orders/${orderId}`).set('Authorization', `Bearer ${token}`);
    return res.body.data;
  }

  it('is true for a delivered order with a returnable product', async () => {
    const order = await deliveredOrderFor({ isReturnable: true });
    expect(order.canReturn).toBe(true);
  });

  it('is false when the product was not returnable when bought', async () => {
    const order = await deliveredOrderFor({ isReturnable: false });
    expect(order.canReturn).toBe(false);
  });
});
