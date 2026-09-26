jest.mock('../Config/razorpay', () => ({
  accounts: { create: jest.fn() },
  stakeholders: { create: jest.fn() },
  products: { requestProductConfiguration: jest.fn(), edit: jest.fn(), fetch: jest.fn() },
  payments: { transfer: jest.fn(), fetch: jest.fn(), refund: jest.fn() },
  transfers: { create: jest.fn(), fetch: jest.fn(), edit: jest.fn(), reverse: jest.fn() },
  orders: { create: jest.fn() },
}));

const mongoose = require('mongoose');
const razorpay = require('../Config/razorpay');

const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const AccountingConfig = require('../Models/AccountingConfig');
const AccountingTransaction = require('../Models/AccountingTransaction');
const ReturnRequest = require('../Models/ReturnRequest');

const settlementService = require('../services/settlementService');
const { insertRows, row } = require('../services/accountingPosting');
const { initiateRazorpayTransferForSettlement } = require('../services/razorpaySettlementIntegration');
const vendorRouteOnboarding = require('../services/vendorRouteOnboarding');
const automation = require('../Jobs/settlementAutomationJob');
const releaseJob = require('../Jobs/settlementReleaseJob');

const { connectTestDb, disconnectTestDb, uniqueSuffix } = require('./helpers');

const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => {
  jest.clearAllMocks();
  delete process.env.RAZORPAY_ROUTE_TRANSFER_MODE;
});

beforeEach(async () => {
  await Promise.all([
    Order.deleteMany({}),
    Vendor.deleteMany({}),
    Settlement.deleteMany({}),
    Payout.deleteMany({}),
    AccountingConfig.deleteMany({}),
    AccountingTransaction.deleteMany({}),
    ReturnRequest.deleteMany({}),
  ]);
  let transferCounter = 0;
  razorpay.payments.transfer.mockImplementation(async () => {
    transferCounter += 1;
    return { items: [{ id: `trf_auto_${uniqueSuffix()}_${transferCounter}` }] };
  });
  razorpay.transfers.create.mockImplementation(async () => ({ id: `trf_direct_${uniqueSuffix()}` }));
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function createVendor(razorpayOverrides = {}, overrides = {}) {
  const suffix = uniqueSuffix();
  return Vendor.create({
    vendorType: 'B2C',
    name: `Seller ${suffix}`,
    email: `seller${suffix}@test.local`,
    mobile: '9998887770',
    password: 'secret123',
    isActive: true,
    verificationStatus: 'APPROVED',
    business: { businessName: `Seller Co ${suffix}`, pan: 'ABCPE1234F' },
    contactPerson: { name: 'Owner', mobile: '9998887770', email: `owner${suffix}@test.local` },
    bank: {
      accountHolderName: 'Seller Co',
      bankName: 'HDFC Bank',
      accountNumber: '50100412344582',
      ifsc: 'HDFC0001234',
    },
    razorpay: {
      accountId: `acc_${suffix}`,
      onboardingStatus: 'ACTIVE',
      isSettlementEligible: true,
      ...razorpayOverrides,
    },
    ...overrides,
  });
}

/**
 * A delivered, prepaid order for `vendor` with its SALE and COMMISSION
 * already on the ledger — exactly what the settlement generator reads.
 * Sale ₹1000, commission ₹100 → seller net ₹900.
 */
async function deliveredLedgeredOrder(vendor, { paymentMethod = 'RAZORPAY', deliveredDaysAgo = 10 } = {}) {
  const suffix = uniqueSuffix();
  const product = new mongoose.Types.ObjectId();
  const deliveredAt = new Date(Date.now() - deliveredDaysAgo * DAY_MS);
  const order = await Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [{ product, vendor: vendor._id, name: 'Test Product', price: 1000, quantity: 1, status: 'DELIVERED' }],
    shippingAddress: {
      fullName: 'Test Buyer',
      phone: '9998887771',
      line1: '123 Test Street',
      city: 'Testville',
      state: 'TS',
      pincode: '123456',
    },
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

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

describe('generateSettlements — batching per payment', () => {
  it('payment mode: one batch per captured payment, each tagged with its payment id', async () => {
    const vendor = await createVendor();
    const orderA = await deliveredLedgeredOrder(vendor);
    const orderB = await deliveredLedgeredOrder(vendor);

    const { count } = await settlementService.generateSettlements();
    expect(count).toBe(2);

    const batches = await Settlement.find({ vendor: vendor._id }).lean();
    expect(batches.map((batch) => batch.razorpayPaymentId).sort()).toEqual(
      [orderA.razorpayPaymentId, orderB.razorpayPaymentId].sort()
    );
    for (const batch of batches) {
      expect(batch.items).toHaveLength(1);
      expect(batch.netPayablePaise).toBe(90000);
    }
  });

  it('direct mode: one batch per seller', async () => {
    process.env.RAZORPAY_ROUTE_TRANSFER_MODE = 'direct';
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await deliveredLedgeredOrder(vendor);

    const { count } = await settlementService.generateSettlements();
    expect(count).toBe(1);
    const [batch] = await Settlement.find({ vendor: vendor._id }).lean();
    expect(batch.items).toHaveLength(2);
    expect(batch.netPayablePaise).toBe(180000);
  });

  it('two generations started together never batch the same line twice', async () => {
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);

    const [first, second] = await Promise.all([
      settlementService.generateSettlements(),
      settlementService.generateSettlements(),
    ]);
    expect(first.count + second.count).toBe(1);
    expect(await Settlement.countDocuments({ vendor: vendor._id })).toBe(1);
  });
});

describe('generateSettlements — pending recovery', () => {
  it('nets the recovery off the next batch and the transfer still passes the amount check', async () => {
    const vendor = await createVendor({ pendingRecoveryPaise: 20000 });
    const order = await deliveredLedgeredOrder(vendor);

    await settlementService.generateSettlements();
    const [batch] = await Settlement.find({ vendor: vendor._id }).lean();
    expect(batch.netPayablePaise).toBe(70000);
    expect(batch.adjustmentsPaise).toBe(-20000);
    expect(batch.recoveryAppliedPaise).toBe(20000);
    expect((await Vendor.findById(vendor._id)).razorpay.pendingRecoveryPaise).toBe(0);

    const result = await initiateRazorpayTransferForSettlement(String(batch._id));
    expect(result.outcome).toBe('TRANSFER_CREATED');
    const [paymentId, payload] = razorpay.payments.transfer.mock.calls[0];
    expect(paymentId).toBe(order.razorpayPaymentId);
    expect(payload.transfers[0].amount).toBe(70000);
  });

  it('a recovery larger than the batch settles it at zero and carries the rest forward', async () => {
    const vendor = await createVendor({ pendingRecoveryPaise: 120000 });
    await deliveredLedgeredOrder(vendor);

    await settlementService.generateSettlements();
    const [batch] = await Settlement.find({ vendor: vendor._id }).lean();
    expect(batch.netPayablePaise).toBe(0);
    expect(batch.status).toBe('COMPLETED');
    expect(batch.mode).toBe('RECOVERY_OFFSET');
    expect((await Vendor.findById(vendor._id)).razorpay.pendingRecoveryPaise).toBe(30000);
  });

  it('cancelling a batch hands its recovery back', async () => {
    const vendor = await createVendor({ pendingRecoveryPaise: 20000 });
    await deliveredLedgeredOrder(vendor);
    await settlementService.generateSettlements();
    const [batch] = await Settlement.find({ vendor: vendor._id }).lean();

    const cancelled = await settlementService.cancelSettlementForRegeneration({ settlementId: batch._id, reason: 'test' });
    expect(cancelled.ok).toBe(true);
    expect((await Vendor.findById(vendor._id)).razorpay.pendingRecoveryPaise).toBe(20000);

    // The line is free again and is re-batched, recovery applied once more.
    await settlementService.generateSettlements();
    const live = await Settlement.find({ vendor: vendor._id, status: 'ELIGIBLE' }).lean();
    expect(live).toHaveLength(1);
    expect(live[0].netPayablePaise).toBe(70000);
  });
});

// ---------------------------------------------------------------------------
// The automation job
// ---------------------------------------------------------------------------

describe('settlementAutomationJob.runOnce', () => {
  it('batches delivered orders and creates one held transfer per payment, with no hold expiry', async () => {
    const vendor = await createVendor();
    const orderA = await deliveredLedgeredOrder(vendor);
    const orderB = await deliveredLedgeredOrder(vendor);

    const summary = await automation.runOnce();
    expect(summary.generated).toBe(2);
    expect(summary.transfers.TRANSFER_CREATED).toBe(2);

    const paymentIds = razorpay.payments.transfer.mock.calls.map(([paymentId]) => paymentId).sort();
    expect(paymentIds).toEqual([orderA.razorpayPaymentId, orderB.razorpayPaymentId].sort());
    for (const [, payload] of razorpay.payments.transfer.mock.calls) {
      expect(payload.transfers[0].on_hold).toBe(true);
      expect(payload.transfers[0].on_hold_until).toBeUndefined();
    }

    const payouts = await Payout.find({ vendor: vendor._id }).lean();
    expect(payouts).toHaveLength(2);
    expect(payouts.every((payout) => payout.status === 'PROCESSING')).toBe(true);

    // A second tick is a no-op.
    const again = await automation.runOnce();
    expect(again.generated).toBe(0);
    expect(razorpay.payments.transfer).toHaveBeenCalledTimes(2);
  });

  it('does nothing in MANUAL mode', async () => {
    await AccountingConfig.create({ key: 'GLOBAL', sellerSettlementMode: 'MANUAL' });
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);

    expect(await automation.runOnce()).toBeNull();
    expect(await Settlement.countDocuments()).toBe(0);
    expect(razorpay.payments.transfer).not.toHaveBeenCalled();
  });

  it('holds a not-yet-active seller, then pays them on the tick after they activate', async () => {
    const vendor = await createVendor({ onboardingStatus: 'KYC_PENDING', isSettlementEligible: false });
    await deliveredLedgeredOrder(vendor);
    razorpay.products.fetch.mockResolvedValue({ activation_status: 'under_review' });

    await automation.runOnce();
    let [batch] = await Settlement.find({ vendor: vendor._id }).lean();
    expect(batch.status).toBe('ON_HOLD');
    expect(batch.holdReason).toBe('VENDOR_RAZORPAY_NOT_ACTIVE');
    expect(razorpay.payments.transfer).not.toHaveBeenCalled();

    await Vendor.updateOne(
      { _id: vendor._id },
      { $set: { 'razorpay.onboardingStatus': 'ACTIVE', 'razorpay.isSettlementEligible': true } }
    );
    await automation.runOnce();
    [batch] = await Settlement.find({ vendor: vendor._id }).lean();
    expect(batch.status).toBe('PROCESSING');
    expect(razorpay.payments.transfer).toHaveBeenCalledTimes(1);
  });

  it('cancels an old multi-payment batch and re-batches it per payment', async () => {
    const vendor = await createVendor();
    const orderA = await deliveredLedgeredOrder(vendor);
    const orderB = await deliveredLedgeredOrder(vendor);

    // What the generator produced before the per-payment split.
    process.env.RAZORPAY_ROUTE_TRANSFER_MODE = 'direct';
    await settlementService.generateSettlements();
    delete process.env.RAZORPAY_ROUTE_TRANSFER_MODE;
    const [legacy] = await Settlement.find({ vendor: vendor._id }).lean();
    const held = await initiateRazorpayTransferForSettlement(String(legacy._id));
    expect(held.reason).toBe('MULTI_ORDER_SETTLEMENT_UNSUPPORTED');

    await automation.runOnce();

    expect((await Settlement.findById(legacy._id)).status).toBe('CANCELLED');
    const live = await Settlement.find({ vendor: vendor._id, status: { $ne: 'CANCELLED' } }).lean();
    expect(live).toHaveLength(2);
    const paymentIds = razorpay.payments.transfer.mock.calls.map(([paymentId]) => paymentId).sort();
    expect(paymentIds).toEqual([orderA.razorpayPaymentId, orderB.razorpayPaymentId].sort());
  });

  it('re-batches a refund-held batch only once Razorpay confirms its transfer fully reversed', async () => {
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await automation.runOnce();
    const [batch] = await Settlement.find({ vendor: vendor._id }).lean();
    const payout = await Payout.findOne({ settlement: batch._id }).lean();

    // What refundService Scenario B leaves behind.
    await Payout.updateOne({ _id: payout._id }, { $set: { status: 'FAILED', failureReason: 'REFUND_BEFORE_RELEASE' } });
    await Settlement.updateOne({ _id: batch._id }, { $set: { status: 'ON_HOLD', holdReason: 'REFUND_BEFORE_RELEASE' } });

    razorpay.transfers.fetch.mockResolvedValue({ id: payout.razorpayTransferId, status: 'processed', amount: 90000, amount_reversed: 40000 });
    await automation.resolveAutoHolds();
    expect((await Settlement.findById(batch._id)).status).toBe('ON_HOLD');

    razorpay.transfers.fetch.mockResolvedValue({ id: payout.razorpayTransferId, status: 'reversed', amount: 90000, amount_reversed: 90000 });
    await automation.resolveAutoHolds();
    expect((await Settlement.findById(batch._id)).status).toBe('CANCELLED');
  });

  it('retries a failed transfer only when the old one is dead, and stops after the attempt cap', async () => {
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await automation.runOnce();
    const [batch] = await Settlement.find({ vendor: vendor._id }).lean();
    const payout = await Payout.findOne({ settlement: batch._id }).lean();

    const longAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);
    await Payout.updateOne({ _id: payout._id }, { $set: { status: 'FAILED', failureReason: 'Bank rejected', processedAt: longAgo } });
    await Settlement.updateOne({ _id: batch._id }, { $set: { status: 'FAILED' } });

    razorpay.transfers.fetch.mockResolvedValue({ id: payout.razorpayTransferId, status: 'processed', amount: 90000, amount_reversed: 0 });
    const blocked = await initiateRazorpayTransferForSettlement(String(batch._id));
    expect(blocked.outcome).toBe('PREVIOUS_TRANSFER_LIVE');

    razorpay.transfers.fetch.mockResolvedValue({ id: payout.razorpayTransferId, status: 'failed', amount: 90000, amount_reversed: 0 });
    const summary = await automation.runOnce();
    expect(summary.retries.retried).toBe(1);
    const attempts = await Payout.find({ settlement: batch._id }).sort({ attempt: 1 }).lean();
    expect(attempts.map((attempt) => attempt.attempt)).toEqual([1, 2]);
    expect(attempts[1].status).toBe('PROCESSING');
  });
});

// ---------------------------------------------------------------------------
// Direct mode
// ---------------------------------------------------------------------------

describe('direct transfer mode', () => {
  it('waits for the settlement window, then pays COD and prepaid together and marks it RELEASED', async () => {
    process.env.RAZORPAY_ROUTE_TRANSFER_MODE = 'direct';
    await AccountingConfig.create({ key: 'GLOBAL', sellerSettlementWindowDays: 2 });
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await deliveredLedgeredOrder(vendor, { paymentMethod: 'COD' });

    await settlementService.generateSettlements();
    const [batch] = await Settlement.find({ vendor: vendor._id }).lean();

    const early = await initiateRazorpayTransferForSettlement(String(batch._id));
    expect(early.outcome).toBe('NOT_DUE');
    expect(razorpay.transfers.create).not.toHaveBeenCalled();

    await Settlement.updateOne({ _id: batch._id }, { $set: { eligibleAt: new Date(Date.now() - 3 * DAY_MS) } });
    const due = await initiateRazorpayTransferForSettlement(String(batch._id));
    expect(due.outcome).toBe('TRANSFER_CREATED');
    expect(razorpay.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: vendor.razorpay.accountId, amount: 180000, currency: 'INR' })
    );
    expect(due.payout.status).toBe('RELEASED');
  });
});

// ---------------------------------------------------------------------------
// Release window
// ---------------------------------------------------------------------------

describe('settlementReleaseJob — settlement window', () => {
  it('holds the transfer until eligibleAt + sellerSettlementWindowDays', async () => {
    await AccountingConfig.create({ key: 'GLOBAL', sellerSettlementWindowDays: 3 });
    const vendor = await createVendor();
    await deliveredLedgeredOrder(vendor);
    await automation.runOnce();
    const [batch] = await Settlement.find({ vendor: vendor._id }).lean();
    razorpay.transfers.edit.mockResolvedValue({ on_hold: false });

    await Settlement.updateOne({ _id: batch._id }, { $set: { eligibleAt: new Date(Date.now() - 2 * DAY_MS) } });
    await releaseJob.runOnce();
    expect(razorpay.transfers.edit).not.toHaveBeenCalled();

    await Settlement.updateOne({ _id: batch._id }, { $set: { eligibleAt: new Date(Date.now() - 4 * DAY_MS) } });
    await releaseJob.runOnce();
    expect(razorpay.transfers.edit).toHaveBeenCalledTimes(1);
    expect((await Payout.findOne({ settlement: batch._id })).status).toBe('RELEASED');
  });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

describe('vendorRouteOnboarding', () => {
  it('creates account, stakeholder and route product with the bank account, and turns eligibility on when activated', async () => {
    const vendor = await createVendor({ accountId: undefined, onboardingStatus: 'NOT_STARTED', isSettlementEligible: false });
    razorpay.accounts.create.mockResolvedValue({ id: 'acc_new1', status: 'created' });
    razorpay.stakeholders.create.mockResolvedValue({ id: 'sth_1' });
    razorpay.products.requestProductConfiguration.mockResolvedValue({ id: 'acc_prd_1', activation_status: 'requested' });
    razorpay.products.edit.mockResolvedValue({ id: 'acc_prd_1', activation_status: 'activated' });

    const result = await vendorRouteOnboarding.onboardVendor(vendor._id);
    expect(result).toEqual({ ok: true, onboardingStatus: 'ACTIVE' });

    expect(razorpay.stakeholders.create).toHaveBeenCalledWith(
      'acc_new1',
      expect.objectContaining({ kyc: { pan: 'ABCPE1234F' } })
    );
    expect(razorpay.products.requestProductConfiguration).toHaveBeenCalledWith('acc_new1', expect.objectContaining({ product_name: 'route' }));
    expect(razorpay.products.edit).toHaveBeenCalledWith('acc_new1', 'acc_prd_1', expect.objectContaining({
      settlements: { account_number: '50100412344582', ifsc_code: 'HDFC0001234', beneficiary_name: 'Seller Co' },
    }));

    const fresh = await Vendor.findById(vendor._id);
    expect(fresh.razorpay.accountId).toBe('acc_new1');
    expect(fresh.razorpay.stakeholderId).toBe('sth_1');
    expect(fresh.razorpay.productId).toBe('acc_prd_1');
    expect(fresh.razorpay.isSettlementEligible).toBe(true);
    expect(fresh.razorpay.eligibilitySetBy).toBe('SYSTEM');
  });

  it('resumes from the failed step and records the error', async () => {
    const vendor = await createVendor({ onboardingStatus: 'ONBOARDING', isSettlementEligible: false });
    razorpay.stakeholders.create.mockRejectedValueOnce({ error: { description: 'Invalid PAN' } });

    const failed = await vendorRouteOnboarding.onboardVendor(vendor._id);
    expect(failed.ok).toBe(false);
    expect((await Vendor.findById(vendor._id)).razorpay.onboardingError).toBe('Invalid PAN');
    expect(razorpay.accounts.create).not.toHaveBeenCalled(); // already had an account

    razorpay.stakeholders.create.mockResolvedValue({ id: 'sth_2' });
    razorpay.products.requestProductConfiguration.mockResolvedValue({ id: 'acc_prd_2' });
    razorpay.products.edit.mockResolvedValue({ id: 'acc_prd_2', activation_status: 'under_review' });
    const resumed = await vendorRouteOnboarding.syncVendorOnboarding(vendor._id);
    expect(resumed).toEqual({ ok: true, onboardingStatus: 'KYC_PENDING' });
    expect((await Vendor.findById(vendor._id)).razorpay.onboardingError).toBe('');
  });

  it('never overrides an eligibility an admin set by hand', async () => {
    const vendor = await createVendor({
      onboardingStatus: 'KYC_PENDING',
      isSettlementEligible: false,
      eligibilitySetBy: 'ADMIN',
      stakeholderId: 'sth_x',
      productId: 'acc_prd_x',
    });
    razorpay.products.fetch.mockResolvedValue({ activation_status: 'activated' });

    await vendorRouteOnboarding.syncVendorOnboarding(vendor._id);
    const fresh = await Vendor.findById(vendor._id);
    expect(fresh.razorpay.onboardingStatus).toBe('ACTIVE');
    expect(fresh.razorpay.isSettlementEligible).toBe(false);
  });

  it('pauses payouts when the bank account changes, and resumes after Razorpay re-activates it', async () => {
    const vendor = await createVendor({ stakeholderId: 'sth_b', productId: 'acc_prd_b', eligibilitySetBy: 'ADMIN' });

    const previousBank = vendor.bank.toObject();
    vendor.bank = { ...previousBank, accountNumber: '99990000111122' };
    expect(vendorRouteOnboarding.markBankChanged(vendor, previousBank)).toBe(true);
    await vendor.save();

    let fresh = await Vendor.findById(vendor._id);
    expect(fresh.razorpay.isSettlementEligible).toBe(false);
    expect(fresh.razorpay.bankSyncPending).toBe(true);

    razorpay.products.edit.mockResolvedValue({ id: 'acc_prd_b', activation_status: 'activated' });
    await vendorRouteOnboarding.syncVendorOnboarding(vendor._id);
    expect(razorpay.products.edit).toHaveBeenCalledWith(fresh.razorpay.accountId, 'acc_prd_b', expect.objectContaining({
      settlements: expect.objectContaining({ account_number: '99990000111122' }),
    }));

    fresh = await Vendor.findById(vendor._id);
    expect(fresh.razorpay.bankSyncPending).toBe(false);
    expect(fresh.razorpay.isSettlementEligible).toBe(true);
  });

  it('does not pause anything when only the bank name changes', async () => {
    const vendor = await createVendor();
    const previousBank = vendor.bank.toObject();
    vendor.bank = { ...previousBank, bankName: 'HDFC' };
    expect(vendorRouteOnboarding.markBankChanged(vendor, previousBank)).toBe(false);
    expect(vendor.razorpay.isSettlementEligible).toBe(true);
  });
});
