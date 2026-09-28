// The payment gateway client too: the refund below goes back to the buyer's
// original payment, and no test may reach the real Razorpay API.
jest.mock('../Config/razorpay', () => ({
  payments: { refund: jest.fn(async () => ({ id: 'rfnd_test1', status: 'processed' })), fetch: jest.fn(), transfer: jest.fn() },
  refunds: { fetch: jest.fn() },
  orders: { create: jest.fn() },
  transfers: { edit: jest.fn(), reverse: jest.fn(), fetch: jest.fn(), create: jest.fn() },
  accounts: { create: jest.fn() },
}));

jest.mock('../services/razorpayxService', () => {
  const actual = jest.requireActual('../services/razorpayxService');
  return {
    ...actual,
    createContact: jest.fn(),
    createBankFundAccount: jest.fn(),
    deactivateFundAccount: jest.fn(),
    createPayout: jest.fn(),
    fetchPayout: jest.fn(),
  };
});

const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const razorpayx = require('../services/razorpayxService');

const app = require('../app');
const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const AccountingConfig = require('../Models/AccountingConfig');
const AccountingTransaction = require('../Models/AccountingTransaction');
const ReturnRequest = require('../Models/ReturnRequest');

const settlementService = require('../services/settlementService');
const { insertRows, row } = require('../services/accountingPosting');
const {
  initiatePayoutForSettlement,
  applyProviderStatus,
  reconcilePayouts,
} = require('../services/razorpayxSettlementIntegration');
const vendorPayoutAccount = require('../services/vendorPayoutAccount');
const { markBankChanged } = require('../services/vendorRouteOnboarding');
const automation = require('../Jobs/settlementAutomationJob');

const { connectTestDb, disconnectTestDb, uniqueSuffix } = require('./helpers');

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

beforeEach(async () => {
  delete process.env.SELLER_PAYOUT_PROVIDER; // default: razorpayx
  process.env.RAZORPAYX_ACCOUNT_NUMBER = '7878780080316316';
  process.env.RAZORPAYX_WEBHOOK_SECRET = 'rzpx_test_webhook_secret';
  jest.clearAllMocks();
  await Promise.all([
    Order.deleteMany({}),
    Vendor.deleteMany({}),
    Settlement.deleteMany({}),
    Payout.deleteMany({}),
    AccountingConfig.deleteMany({}),
    AccountingTransaction.deleteMany({}),
    ReturnRequest.deleteMany({}),
  ]);
  // No extra window after batching unless a test says otherwise.
  await AccountingConfig.create({ key: 'GLOBAL', sellerSettlementWindowDays: 0 });

  let counter = 0;
  razorpayx.createContact.mockImplementation(async () => ({ id: `cont_${uniqueSuffix()}` }));
  razorpayx.createBankFundAccount.mockImplementation(async () => {
    counter += 1;
    return { id: `fa_${uniqueSuffix()}_${counter}` };
  });
  razorpayx.deactivateFundAccount.mockResolvedValue({ active: false });
  razorpayx.createPayout.mockImplementation(async ({ referenceId }) => ({
    id: `pout_${uniqueSuffix()}`,
    status: 'processing',
    reference_id: referenceId,
  }));
});

afterAll(() => {
  delete process.env.RAZORPAYX_ACCOUNT_NUMBER;
  delete process.env.RAZORPAYX_WEBHOOK_SECRET;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function createVendor({ withPayoutAccount = true, ...overrides } = {}) {
  const suffix = uniqueSuffix();
  const vendor = await Vendor.create({
    vendorType: 'B2C',
    name: `Seller ${suffix}`,
    email: `seller${suffix}@test.local`,
    mobile: '9998887770',
    password: 'secret123',
    isActive: true,
    verificationStatus: 'APPROVED',
    business: { businessName: `Seller Co ${suffix}` },
    bank: {
      accountHolderName: 'Seller Co',
      bankName: 'HDFC Bank',
      accountNumber: '50100412344582',
      ifsc: 'HDFC0001234',
    },
    ...overrides,
  });
  if (withPayoutAccount) await vendorPayoutAccount.ensurePayoutAccount(vendor._id);
  return Vendor.findById(vendor._id);
}

/**
 * A delivered order for `vendor` with SALE ₹1000 and COMMISSION ₹100 on the
 * ledger — seller net ₹900 — delivered long enough ago to be settleable.
 */
async function deliveredLedgeredOrder(vendor, { paymentMethod = 'RAZORPAY' } = {}) {
  const suffix = uniqueSuffix();
  const product = new mongoose.Types.ObjectId();
  const deliveredAt = new Date(Date.now() - 10 * DAY_MS);
  const order = await Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [{ product, vendor: vendor._id, name: 'Test Product', price: 1000, quantity: 1, status: 'DELIVERED' }],
    shippingAddress: { fullName: 'Buyer', phone: '9998887771', line1: '1 Street', city: 'City', state: 'ST', pincode: '123456' },
    subtotal: 1000,
    total: 1000,
    paymentMethod,
    paymentStatus: 'PAID',
    razorpayPaymentId: paymentMethod === 'RAZORPAY' ? `pay_${suffix}` : null,
    codRemittedAt: paymentMethod === 'COD' ? deliveredAt : null,
    status: 'DELIVERED',
    deliveredAt,
  });
  await Order.updateOne({ _id: order._id }, { $set: { deliveredAt, 'items.0.status': 'DELIVERED' } });
  await insertRows([
    row({ type: 'SALE', direction: 'CREDIT', amountPaise: 100000, order: order._id, product, vendor: vendor._id, eventKey: `SALE:${suffix}` }),
    row({ type: 'COMMISSION', direction: 'DEBIT', amountPaise: 10000, order: order._id, product, vendor: vendor._id, eventKey: `COMMISSION:${suffix}` }),
  ]);
  return Order.findById(order._id).lean();
}

async function paidSettlement(vendor) {
  await deliveredLedgeredOrder(vendor);
  await settlementService.generateSettlements();
  const [settlement] = await Settlement.find({ vendor: vendor._id }).lean();
  const result = await initiatePayoutForSettlement(String(settlement._id));
  expect(result.outcome).toBe('PAYOUT_CREATED');
  return { settlement, payout: await Payout.findOne({ settlement: settlement._id }).lean() };
}

function signedWebhook(body) {
  const raw = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAYX_WEBHOOK_SECRET).update(raw).digest('hex');
  return request(app)
    .post('/webhook/razorpayx-payouts')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signature)
    .send(raw);
}

// ---------------------------------------------------------------------------
// Payee setup
// ---------------------------------------------------------------------------

describe('vendorPayoutAccount', () => {
  it('creates a contact and a bank fund account, after which the seller is payable', async () => {
    const vendor = await createVendor();
    expect(razorpayx.createContact).toHaveBeenCalledWith(expect.objectContaining({ referenceId: String(vendor._id) }));
    expect(razorpayx.createBankFundAccount).toHaveBeenCalledWith(
      expect.objectContaining({ ifsc: 'HDFC0001234', accountNumber: '50100412344582', name: 'Seller Co' })
    );
    expect(vendor.razorpayx.fundAccountId).toMatch(/^fa_/);
    expect(vendorPayoutAccount.payoutAccountReady(vendor).ready).toBe(true);
  });

  it('a changed bank account gets a new fund account, retires the old one, and waits out the cool-off', async () => {
    const vendor = await createVendor();
    const oldFundAccount = vendor.razorpayx.fundAccountId;

    const previousBank = vendor.bank.toObject();
    vendor.bank = { ...previousBank, accountNumber: '99990000111122' };
    expect(markBankChanged(vendor, previousBank)).toBe(true);
    await vendor.save();

    let fresh = await Vendor.findById(vendor._id);
    expect(vendorPayoutAccount.payoutAccountReady(fresh).ready).toBe(false);

    const summary = await vendorPayoutAccount.syncPendingPayoutAccounts();
    expect(summary.ready).toBe(1);
    fresh = await Vendor.findById(vendor._id);
    expect(fresh.razorpayx.fundAccountId).not.toBe(oldFundAccount);
    expect(razorpayx.deactivateFundAccount).toHaveBeenCalledWith(oldFundAccount);

    // Still inside the 48h cool-off…
    expect(vendorPayoutAccount.payoutAccountReady(fresh).ready).toBe(false);
    // …and payable once it has passed.
    expect(vendorPayoutAccount.payoutAccountReady(fresh, new Date(Date.now() + 49 * 60 * 60 * 1000)).ready).toBe(true);
  });

  it('a first-ever bank account has no cool-off', async () => {
    const vendor = await createVendor({ withPayoutAccount: false, bank: {} });
    const previousBank = vendor.bank.toObject();
    vendor.bank = { accountHolderName: 'Seller Co', accountNumber: '50100412344582', ifsc: 'HDFC0001234' };
    markBankChanged(vendor, previousBank);
    await vendor.save();
    await vendorPayoutAccount.ensurePayoutAccount(vendor._id);
    expect(vendorPayoutAccount.payoutAccountReady(await Vendor.findById(vendor._id)).ready).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Batching and paying
// ---------------------------------------------------------------------------

describe('RazorpayX payouts', () => {
  it('batches prepaid and COD lines of a seller together and pays the batch in one payout', async () => {
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await deliveredLedgeredOrder(vendor, { paymentMethod: 'COD' });

    const summary = await automation.runOnce();
    expect(summary.provider).toBe('razorpayx');
    expect(summary.generated).toBe(1);
    expect(summary.payouts.PAYOUT_CREATED).toBe(1);

    expect(razorpayx.createPayout).toHaveBeenCalledTimes(1);
    const [call] = razorpayx.createPayout.mock.calls[0];
    expect(call.amountPaise).toBe(180000);
    expect(call.fundAccountId).toBe(vendor.razorpayx.fundAccountId);
    expect(call.idempotencyKey).toMatch(UUID);

    const payout = await Payout.findOne({ vendor: vendor._id }).lean();
    expect(payout.method).toBe('RAZORPAYX_PAYOUT');
    expect(payout.status).toBe('PROCESSING');
    expect(payout.razorpayxPayoutId).toMatch(/^pout_/);

    // Nothing more on the next tick.
    await automation.runOnce();
    expect(razorpayx.createPayout).toHaveBeenCalledTimes(1);
  });

  it('waits for the settlement window before paying', async () => {
    await AccountingConfig.updateOne({ key: 'GLOBAL' }, { $set: { sellerSettlementWindowDays: 3 } });
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await settlementService.generateSettlements();
    const [settlement] = await Settlement.find({ vendor: vendor._id }).lean();

    expect((await initiatePayoutForSettlement(String(settlement._id))).outcome).toBe('NOT_DUE');
    const later = new Date(Date.now() + 4 * DAY_MS);
    expect((await initiatePayoutForSettlement(String(settlement._id), { now: later })).outcome).toBe('PAYOUT_CREATED');
  });

  it('holds a seller who is not set up yet, and pays them once they are', async () => {
    const vendor = await createVendor({ withPayoutAccount: false });
    await deliveredLedgeredOrder(vendor);
    razorpayx.createContact.mockRejectedValueOnce(Object.assign(new Error('Service down'), { statusCode: 503 }));

    await automation.runOnce();
    let [settlement] = await Settlement.find({ vendor: vendor._id }).lean();
    expect(settlement.status).toBe('ON_HOLD');
    expect(settlement.holdReason).toBe('VENDOR_PAYOUT_ACCOUNT_NOT_READY');
    expect((await Vendor.findById(vendor._id)).razorpayx.lastError).toBe('Service down');

    await automation.runOnce();
    [settlement] = await Settlement.find({ vendor: vendor._id }).lean();
    expect(settlement.status).toBe('PROCESSING');
    expect(razorpayx.createPayout).toHaveBeenCalledTimes(1);
  });

  it('does not pay while a return is open on a line', async () => {
    const vendor = await createVendor();
    const order = await deliveredLedgeredOrder(vendor);
    await ReturnRequest.create({
      user: order.user,
      order: order._id,
      product: order.items[0].product,
      productName: 'Test Product',
      requestType: 'REFUND',
      reason: 'Damaged',
      status: 'PENDING',
      refundAmount: 500,
    });

    await automation.runOnce();
    const [settlement] = await Settlement.find({ vendor: vendor._id }).lean();
    expect(settlement.holdReason).toBe('ACTIVE_RETURN_OR_REFUND');
    expect(razorpayx.createPayout).not.toHaveBeenCalled();

    // Still open on the next tick: stays held, not re-batched.
    await automation.runOnce();
    expect((await Settlement.findById(settlement._id)).status).toBe('ON_HOLD');
  });

  it('reports NOT_CONFIGURED without a RazorpayX account number, and pays nothing', async () => {
    delete process.env.RAZORPAYX_ACCOUNT_NUMBER;
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await settlementService.generateSettlements();
    const [settlement] = await Settlement.find({ vendor: vendor._id }).lean();

    const result = await initiatePayoutForSettlement(String(settlement._id));
    expect(result.outcome).toBe('NOT_CONFIGURED');
    expect(razorpayx.createPayout).not.toHaveBeenCalled();
    expect((await Settlement.findById(settlement._id)).status).toBe('ELIGIBLE');
  });
});

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

describe('RazorpayX payout outcomes', () => {
  it('processed: completes the payout with the UTR, debits the ledger and marks the settlement paid', async () => {
    const vendor = await createVendor();
    const { settlement, payout } = await paidSettlement(vendor);

    await applyProviderStatus(payout._id, { id: payout.razorpayxPayoutId, status: 'processed', utr: 'HDFCN00000000001' });

    const done = await Payout.findById(payout._id).lean();
    expect(done.status).toBe('COMPLETED');
    expect(done.utr).toBe('HDFCN00000000001');
    expect((await Settlement.findById(settlement._id)).status).toBe('COMPLETED');
    const payoutRows = await AccountingTransaction.find({ type: 'PAYOUT', vendor: vendor._id }).lean();
    expect(payoutRows.map((entry) => entry.debit)).toEqual([90000]);

    // Applying it again changes nothing.
    await applyProviderStatus(payout._id, { id: payout.razorpayxPayoutId, status: 'processed', utr: 'HDFCN00000000001' });
    expect(await AccountingTransaction.countDocuments({ type: 'PAYOUT', vendor: vendor._id })).toBe(1);
  });

  it('reversed after processed: reverses the ledger debit and holds until the bank account changes', async () => {
    const vendor = await createVendor();
    const { settlement, payout } = await paidSettlement(vendor);
    await applyProviderStatus(payout._id, { id: payout.razorpayxPayoutId, status: 'processed', utr: 'UTR1' });
    await applyProviderStatus(payout._id, {
      id: payout.razorpayxPayoutId,
      status: 'reversed',
      status_details: { description: 'Beneficiary account is closed' },
    });

    expect((await Payout.findById(payout._id)).status).toBe('REVERSED');
    const held = await Settlement.findById(settlement._id);
    expect(held.status).toBe('ON_HOLD');
    expect(held.holdReason).toBe('PAYOUT_REVERSED_BY_BANK');
    const rows = await AccountingTransaction.find({ vendor: vendor._id }).lean();
    expect(rows.reduce((total, entry) => total + entry.credit - entry.debit, 0)).toBe(90000); // owed again

    // Same bank account: stays held.
    await automation.resolveAutoHolds('razorpayx');
    expect((await Settlement.findById(settlement._id)).status).toBe('ON_HOLD');

    // New bank account, cool-off passed: released and paid on the next tick.
    const fresh = await Vendor.findById(vendor._id);
    const previousBank = fresh.bank.toObject();
    fresh.bank = { ...previousBank, accountNumber: '99990000111122' };
    markBankChanged(fresh, previousBank);
    fresh.razorpayx.bankChangedAt = new Date(Date.now() - 49 * 60 * 60 * 1000);
    await fresh.save();

    await automation.runOnce();
    const attempts = await Payout.find({ settlement: settlement._id }).sort({ attempt: 1 }).lean();
    expect(attempts.map((attempt) => attempt.status)).toEqual(['REVERSED', 'PROCESSING']);
    expect(attempts[1].razorpayxFundAccountId).not.toBe(attempts[0].razorpayxFundAccountId);
  });

  it('a rejected create fails the attempt; the retry after the cool-down is a new attempt with a new key', async () => {
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await settlementService.generateSettlements();
    const [settlement] = await Settlement.find({ vendor: vendor._id }).lean();

    razorpayx.createPayout.mockRejectedValueOnce(Object.assign(new Error('Invalid IFSC'), { statusCode: 400 }));
    const first = await initiatePayoutForSettlement(String(settlement._id));
    expect(first.outcome).toBe('FAILED');
    expect((await Settlement.findById(settlement._id)).status).toBe('FAILED');

    const later = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const summary = await automation.runOnce({ now: later });
    expect(summary.retries.retried).toBe(1);

    const keys = razorpayx.createPayout.mock.calls.map(([call]) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
    const attempts = await Payout.find({ settlement: settlement._id }).sort({ attempt: 1 }).lean();
    expect(attempts.map((attempt) => [attempt.attempt, attempt.status])).toEqual([[1, 'FAILED'], [2, 'PROCESSING']]);
  });

  it('a lost response leaves the attempt PENDING and reconcile re-sends it with the SAME key', async () => {
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await settlementService.generateSettlements();
    const [settlement] = await Settlement.find({ vendor: vendor._id }).lean();

    razorpayx.createPayout.mockRejectedValueOnce(Object.assign(new Error('socket hang up'), { statusCode: null }));
    const first = await initiatePayoutForSettlement(String(settlement._id));
    expect(first.outcome).toBe('SUBMIT_UNCONFIRMED');
    expect((await Payout.findOne({ settlement: settlement._id })).status).toBe('PENDING');

    const summary = await reconcilePayouts(new Date(Date.now() + 10 * 60 * 1000));
    expect(summary.resubmitted).toBe(1);
    const [[firstCall], [secondCall]] = razorpayx.createPayout.mock.calls;
    expect(secondCall.idempotencyKey).toBe(firstCall.idempotencyKey);
    expect(await Payout.countDocuments({ settlement: settlement._id })).toBe(1);
    expect((await Payout.findOne({ settlement: settlement._id })).status).toBe('PROCESSING');
  });

  it('reconcile picks up a processed payout whose webhook never came', async () => {
    const vendor = await createVendor();
    const { payout } = await paidSettlement(vendor);
    await Payout.updateOne({ _id: payout._id }, { $set: { updatedAt: new Date(Date.now() - DAY_MS) } }, { timestamps: false });
    razorpayx.fetchPayout.mockResolvedValue({ id: payout.razorpayxPayoutId, status: 'processed', utr: 'UTR_POLL' });

    await reconcilePayouts();
    expect((await Payout.findById(payout._id)).utr).toBe('UTR_POLL');
  });
});

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

describe('POST /webhook/razorpayx-payouts', () => {
  it('rejects a bad signature', async () => {
    const res = await request(app)
      .post('/webhook/razorpayx-payouts')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'nope')
      .send(JSON.stringify({ event: 'payout.processed' }));
    expect(res.status).toBe(401);
  });

  it('completes the payout on payout.processed, found by reference_id if the id is not stored yet', async () => {
    const vendor = await createVendor();
    const { payout } = await paidSettlement(vendor);
    await Payout.updateOne({ _id: payout._id }, { $unset: { razorpayxPayoutId: '' } });

    const res = await signedWebhook({
      event: 'payout.processed',
      payload: { payout: { entity: { id: 'pout_webhook1', status: 'processed', utr: 'UTR_WEBHOOK', reference_id: payout.payoutId } } },
    });
    expect(res.status).toBe(200);

    const done = await Payout.findById(payout._id).lean();
    expect(done.status).toBe('COMPLETED');
    expect(done.utr).toBe('UTR_WEBHOOK');
    expect(done.razorpayxPayoutId).toBe('pout_webhook1');
  });
});

// ---------------------------------------------------------------------------
// Refund after payout
// ---------------------------------------------------------------------------

describe('refund after a RazorpayX payout', () => {
  it('records the over-payment as a recovery, without double-counting it on the ledger', async () => {
    const vendor = await createVendor();
    const order = await deliveredLedgeredOrder(vendor);
    await settlementService.generateSettlements();
    const [settlement] = await Settlement.find({ vendor: vendor._id }).lean();
    await initiatePayoutForSettlement(String(settlement._id));
    const payout = await Payout.findOne({ settlement: settlement._id }).lean();
    await applyProviderStatus(payout._id, { id: payout.razorpayxPayoutId, status: 'processed', utr: 'UTR1' });

    const Customer = require('../Models/Customer');
    await Customer.create({ _id: order.user, name: 'Buyer', mobileNumber: `9${uniqueSuffix().slice(-9)}`, isActive: true });
    const returnRequest = await ReturnRequest.create({
      user: order.user,
      order: order._id,
      product: order.items[0].product,
      productName: 'Test Product',
      requestType: 'REFUND',
      reason: 'Damaged',
      status: 'PENDING',
      refundAmount: 1000,
    });

    const refundService = require('../services/refundService');
    const decided = await refundService.decideReturnRefund({
      requestId: String(returnRequest._id),
      decision: 'APPROVED',
      admin: { _id: null, name: 'TEST' },
    });
    expect(decided.ok).toBe(true);

    const rows = await AccountingTransaction.find({ vendor: vendor._id }).lean();
    const balance = rows.reduce((total, entry) => total + entry.credit - entry.debit, 0);
    const owed = (await Vendor.findById(vendor._id)).razorpay.pendingRecoveryPaise;
    expect(owed).toBeGreaterThan(0);
    // The recovery equals the negative balance the refund left — once.
    expect(balance).toBe(-owed);
    expect(await AccountingTransaction.countDocuments({ vendor: vendor._id, type: 'ADJUSTMENT' })).toBe(0);
  });
});
