jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const razorpay = require('../Config/razorpay');
const { connectTestDb, disconnectTestDb, createCustomer } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.clearAllMocks());

describe('wallet top-up amount verification (regression: pay-1-get-credited-99999)', () => {
  it('credits only what Razorpay actually captured, ignoring a client-supplied amount', async () => {
    const { token } = await createCustomer();

    const orderId = 'order_wallet1';
    const paymentId = 'pay_wallet1';
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    razorpay.payments.fetch.mockResolvedValue({ order_id: orderId, status: 'captured', amount: 100 }); // ₹1

    const res = await request(app)
      .post('/user/wallet/topup/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        amount: 99999, // attacker-supplied — must be ignored
      });

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(1);
  });

  it('rejects verification when the payment was not actually captured', async () => {
    const { token } = await createCustomer();
    const orderId = 'order_wallet2';
    const paymentId = 'pay_wallet2';
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    razorpay.payments.fetch.mockResolvedValue({ order_id: orderId, status: 'failed', amount: 10000 });

    const res = await request(app)
      .post('/user/wallet/topup/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });

    expect(res.status).toBe(400);
  });
});
