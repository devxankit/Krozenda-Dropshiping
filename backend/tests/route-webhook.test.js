jest.mock('../Config/razorpay', () => ({
  accounts: { create: jest.fn() },
  payments: { transfer: jest.fn(), fetch: jest.fn(), refund: jest.fn() },
  transfers: { edit: jest.fn(), reverse: jest.fn() },
  orders: { create: jest.fn() },
}));

// notificationController is required by routeWebhookController via
// destructuring (`const { createNotification } = require(...)`) at module
// load time, so a jest.spyOn applied later in a test body would be spying on
// a property nobody still reads — the controller already holds its own
// direct reference to the original function. Mocking the whole module here,
// before app.js (and therefore routeWebhookController) is required below, is
// the only point at which replacing it actually takes effect.
jest.mock('../Controllers/notificationController', () => ({
  ...jest.requireActual('../Controllers/notificationController'),
  createNotification: jest.fn().mockResolvedValue(true),
}));

const mongoose = require('mongoose');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');

const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const { createNotification } = require('../Controllers/notificationController');

const { connectTestDb, disconnectTestDb, uniqueSuffix } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.clearAllMocks());

beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), Vendor.deleteMany({}), Settlement.deleteMany({}), Payout.deleteMany({})]);
});

async function createVendorSettlementPayout(status) {
  const suffix = uniqueSuffix();
  const vendor = await Vendor.create({
    vendorType: 'B2C',
    name: `Seller ${suffix}`,
    email: `seller${suffix}@test.local`,
    mobile: '9998887770',
    password: 'secret123',
    isActive: true,
    business: { businessName: `ABC Electronics ${suffix}` },
    bank: { accountHolderName: 'ABC', bankName: 'HDFC', accountNumber: '50100412344582', ifsc: 'HDFC0001234' },
    razorpay: { accountId: `acc_${suffix}`, onboardingStatus: 'ACTIVE', isSettlementEligible: true },
  });

  const settlement = await Settlement.create({
    vendor: vendor._id,
    items: [
      {
        order: new mongoose.Types.ObjectId(),
        product: new mongoose.Types.ObjectId(),
        name: 'Test Product',
        quantity: 1,
        grossAmount: 1000,
        commissionAmount: 100,
        netAmount: 900,
        deliveredAt: new Date(),
      },
    ],
    grossAmount: 1000,
    commissionAmount: 100,
    netAmount: 900,
    status: 'PROCESSING',
    netPayablePaise: 90000,
    grossPaise: 100000,
    commissionPaise: 10000,
  });

  const payout = await Payout.create({
    payoutId: `PO-${suffix}`,
    vendor: vendor._id,
    settlement: settlement._id,
    amount: 90000,
    method: 'RAZORPAY_ROUTE',
    status,
    razorpayTransferId: `trf_${suffix}`,
    razorpayAccountId: vendor.razorpay.accountId,
    idempotencyKey: `SETTLEMENT:${settlement._id}:ATTEMPT:1`,
  });

  return { vendor, settlement, payout };
}

function signedPost(path, body) {
  const raw = JSON.stringify(body);
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret')
    .update(raw)
    .digest('hex');
  return request(app)
    .post(path)
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signature)
    .send(raw);
}

describe('POST /webhook/route-transfers', () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret';
  });

  it('rejects a request with a wrong signature (401)', async () => {
    const { payout } = await createVendorSettlementPayout('PROCESSING');
    const body = { event: 'transfer.processed', payload: { transfer: { entity: { id: payout.razorpayTransferId, amount: 90000 } } } };

    const res = await request(app)
      .post('/webhook/route-transfers')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'deadbeef')
      .send(JSON.stringify(body));

    expect(res.status).toBe(401);

    const fresh = await Payout.findById(payout._id);
    expect(fresh.status).toBe('PROCESSING'); // untouched
  });

  it('transfer.processed moves a RELEASED Payout to COMPLETED, sets Settlement paidAt, and notifies once', async () => {
    const { payout, settlement } = await createVendorSettlementPayout('RELEASED');

    const body = {
      event: 'transfer.processed',
      payload: { transfer: { entity: { id: payout.razorpayTransferId, amount: 90000 } } },
    };

    const res1 = await signedPost('/webhook/route-transfers', body);
    expect(res1.status).toBe(200);

    let fresh = await Payout.findById(payout._id);
    expect(fresh.status).toBe('COMPLETED');
    expect(fresh.utr).toBe(payout.razorpayTransferId);

    let freshSettlement = await Settlement.findById(settlement._id);
    expect(freshSettlement.status).toBe('COMPLETED');
    expect(freshSettlement.paidAt).toBeTruthy();

    expect(createNotification).toHaveBeenCalledTimes(1);

    // Deliver the SAME webhook a second time.
    const res2 = await signedPost('/webhook/route-transfers', body);
    expect(res2.status).toBe(200);

    fresh = await Payout.findById(payout._id);
    expect(fresh.status).toBe('COMPLETED'); // still COMPLETED, no duplicate state change

    // NOTE: routeWebhookController's handleTransferProcessed short-circuits
    // on payout.status === 'COMPLETED' BEFORE calling notifyVendorOfSettlement
    // a second time (see the early `if (payout.status === 'COMPLETED')` guard
    // in Controllers/routeWebhookController.js) — so this asserts the
    // no-duplicate-notification behavior rather than flagging it as a gap.
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it('transfer.failed moves the Payout to FAILED with the reported failureReason', async () => {
    const { payout } = await createVendorSettlementPayout('PROCESSING');

    const body = {
      event: 'transfer.failed',
      payload: {
        transfer: { entity: { id: payout.razorpayTransferId, error: { description: 'Insufficient balance in the account' } } },
      },
    };

    const res = await signedPost('/webhook/route-transfers', body);
    expect(res.status).toBe(200);

    const fresh = await Payout.findById(payout._id);
    expect(fresh.status).toBe('FAILED');
    expect(fresh.failureReason).toBe('Insufficient balance in the account');
  });
});
