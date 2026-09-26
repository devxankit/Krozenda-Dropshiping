jest.mock('../Config/razorpay', () => ({
  accounts: { create: jest.fn() },
  payments: { transfer: jest.fn(), fetch: jest.fn(), refund: jest.fn() },
  transfers: { edit: jest.fn(), reverse: jest.fn() },
  orders: { create: jest.fn() },
}));

const mongoose = require('mongoose');
const razorpay = require('../Config/razorpay');

const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const AccountingConfig = require('../Models/AccountingConfig');
const ReturnRequest = require('../Models/ReturnRequest');

const {
  initiateRazorpayTransferForSettlement,
  releaseSinglePayout,
} = require('../services/razorpaySettlementIntegration');
const { runOnce } = require('../Jobs/settlementReleaseJob');
const razorpayRouteService = require('../services/razorpayRouteService');
const refundService = require('../services/refundService');

const { connectTestDb, disconnectTestDb, uniqueSuffix } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.clearAllMocks());

beforeEach(async () => {
  await Promise.all([
    Order.deleteMany({}),
    Vendor.deleteMany({}),
    Settlement.deleteMany({}),
    Payout.deleteMany({}),
    AccountingConfig.deleteMany({}),
    ReturnRequest.deleteMany({}),
  ]);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function createActiveVendor(overrides = {}) {
  const suffix = uniqueSuffix();
  return Vendor.create({
    vendorType: 'B2C',
    name: `Seller ${suffix}`,
    email: `seller${suffix}@test.local`,
    mobile: '9998887770',
    password: 'secret123',
    isActive: true,
    verificationStatus: 'APPROVED',
    business: { businessName: `ABC Electronics ${suffix}` },
    bank: {
      accountHolderName: 'ABC Electronics',
      bankName: 'HDFC Bank',
      accountNumber: '50100412344582',
      ifsc: 'HDFC0001234',
    },
    razorpay: {
      accountId: `acc_${suffix}`,
      onboardingStatus: 'ACTIVE',
      isSettlementEligible: true,
    },
    ...overrides,
  });
}

async function createPaidOrder(vendorId, overrides = {}) {
  const suffix = uniqueSuffix();
  return Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        vendor: vendorId,
        name: 'Test Product',
        price: 1000,
        quantity: 1,
      },
    ],
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
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    razorpayPaymentId: `pay_${suffix}`,
    status: 'DELIVERED',
    ...overrides,
  });
}

// A settlement with one item against `order`, amounts internally consistent
// (netPayablePaise = gross - commission), eligible now (in the past) unless
// overridden.
async function createEligibleSettlement({ vendor, order, product, eligibleAt, overrides = {} }) {
  const grossPaise = 100000; // ₹1000
  const commissionPaise = 10000; // ₹100
  const netPayablePaise = grossPaise - commissionPaise;
  return Settlement.create({
    vendor: vendor._id,
    items: [
      {
        order: order._id,
        product,
        name: 'Test Product',
        quantity: 1,
        grossAmount: 1000,
        commissionAmount: 100,
        netAmount: 900,
        deliveredAt: new Date(),
        paymentMethod: 'RAZORPAY',
      },
    ],
    grossAmount: 1000,
    commissionAmount: 100,
    netAmount: 900,
    status: 'ELIGIBLE',
    grossPaise,
    commissionPaise,
    feesPaise: 0,
    refundsPaise: 0,
    adjustmentsPaise: 0,
    netPayablePaise,
    eligibleAt: eligibleAt !== undefined ? eligibleAt : new Date(Date.now() - 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 1. Not yet at eligibleAt
// ---------------------------------------------------------------------------

describe('release job — eligibility gate', () => {
  it('does not release a Payout whose settlement is not yet at eligibleAt', async () => {
    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({
      vendor,
      order,
      product: order.items[0].product,
      eligibleAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // in the future
    });

    razorpay.payments.transfer.mockResolvedValue({ items: [{ id: 'trf_notdue' }] });
    const initiated = await initiateRazorpayTransferForSettlement(String(settlement._id));
    expect(initiated.outcome).toBe('TRANSFER_CREATED');

    razorpay.transfers.edit.mockClear();
    const result = await runOnce();
    expect(result.checked).toBe(1);
    expect(razorpay.transfers.edit).not.toHaveBeenCalled();

    const payout = await Payout.findOne({ settlement: settlement._id });
    expect(payout.status).toBe('PROCESSING'); // unchanged
  });
});

// ---------------------------------------------------------------------------
// 2. Vendor not ACTIVE / eligible
// ---------------------------------------------------------------------------

describe('initiateRazorpayTransferForSettlement — vendor eligibility', () => {
  it('holds with VENDOR_RAZORPAY_NOT_ACTIVE and creates no transfer when vendor is not ACTIVE', async () => {
    const vendor = await createActiveVendor({ razorpay: { onboardingStatus: 'ONBOARDING', isSettlementEligible: false } });
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    const result = await initiateRazorpayTransferForSettlement(String(settlement._id));

    expect(result.outcome).toBe('HELD');
    expect(result.reason).toBe('VENDOR_RAZORPAY_NOT_ACTIVE');
    expect(razorpay.payments.transfer).not.toHaveBeenCalled();

    const fresh = await Settlement.findById(settlement._id);
    expect(fresh.status).toBe('ON_HOLD');
    expect(fresh.holdReason).toBe('VENDOR_RAZORPAY_NOT_ACTIVE');
  });
});

// ---------------------------------------------------------------------------
// 3. Active return/refund on a line
// ---------------------------------------------------------------------------

describe('initiateRazorpayTransferForSettlement — active return/refund', () => {
  it('holds with ACTIVE_RETURN_OR_REFUND and creates no transfer', async () => {
    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    await ReturnRequest.create({
      user: new mongoose.Types.ObjectId(),
      order: order._id,
      product: order.items[0].product,
      productName: 'Test Product',
      requestType: 'REFUND',
      reason: 'Damaged',
      status: 'PENDING',
      refundAmount: 500,
    });

    const result = await initiateRazorpayTransferForSettlement(String(settlement._id));

    expect(result.outcome).toBe('HELD');
    expect(result.reason).toBe('ACTIVE_RETURN_OR_REFUND');
    expect(razorpay.payments.transfer).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Amount mismatch
// ---------------------------------------------------------------------------

describe('initiateRazorpayTransferForSettlement — amount sanity', () => {
  it('holds with AMOUNT_MISMATCH when netPayablePaise does not reconcile', async () => {
    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({
      vendor,
      order,
      product: order.items[0].product,
      overrides: { netPayablePaise: 999999 }, // wildly inconsistent with gross/commission
    });

    const result = await initiateRazorpayTransferForSettlement(String(settlement._id));

    expect(result.outcome).toBe('HELD');
    expect(result.reason).toBe('AMOUNT_MISMATCH');
    expect(razorpay.payments.transfer).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. Happy path
// ---------------------------------------------------------------------------

describe('initiateRazorpayTransferForSettlement — happy path', () => {
  it('creates a held transfer and a PROCESSING Payout with the correct amount', async () => {
    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    razorpay.payments.transfer.mockResolvedValue({ items: [{ id: 'trf_happy1' }] });

    const result = await initiateRazorpayTransferForSettlement(String(settlement._id));

    expect(result.outcome).toBe('TRANSFER_CREATED');
    expect(razorpay.payments.transfer).toHaveBeenCalledTimes(1);
    const [paymentId, payload] = razorpay.payments.transfer.mock.calls[0];
    expect(paymentId).toBe(order.razorpayPaymentId);
    expect(payload.transfers[0].amount).toBe(settlement.netPayablePaise);
    expect(payload.transfers[0].account).toBe(vendor.razorpay.accountId);
    expect(payload.transfers[0].on_hold).toBe(true);
    // No expiry on the hold: only settlementReleaseJob (after its safety
    // re-check) may release it, never Razorpay's own clock.
    expect(payload.transfers[0].on_hold_until).toBeUndefined();

    const payout = await Payout.findOne({ settlement: settlement._id });
    expect(payout.status).toBe('PROCESSING');
    expect(payout.razorpayTransferId).toBe('trf_happy1');
    expect(payout.method).toBe('RAZORPAY_ROUTE');
  });
});

// ---------------------------------------------------------------------------
// 6. Multi-order settlement unsupported
// ---------------------------------------------------------------------------

describe('initiateRazorpayTransferForSettlement — multi-payment settlement', () => {
  it('holds with MULTI_ORDER_SETTLEMENT_UNSUPPORTED when items span >1 distinct Razorpay payment', async () => {
    const vendor = await createActiveVendor();
    const orderA = await createPaidOrder(vendor._id);
    const orderB = await createPaidOrder(vendor._id);

    const settlement = await Settlement.create({
      vendor: vendor._id,
      items: [
        {
          order: orderA._id,
          product: orderA.items[0].product,
          name: 'Product A',
          quantity: 1,
          grossAmount: 1000,
          commissionAmount: 100,
          netAmount: 900,
          deliveredAt: new Date(),
          paymentMethod: 'RAZORPAY',
        },
        {
          order: orderB._id,
          product: orderB.items[0].product,
          name: 'Product B',
          quantity: 1,
          grossAmount: 1000,
          commissionAmount: 100,
          netAmount: 900,
          deliveredAt: new Date(),
          paymentMethod: 'RAZORPAY',
        },
      ],
      grossAmount: 2000,
      commissionAmount: 200,
      netAmount: 1800,
      status: 'ELIGIBLE',
      grossPaise: 200000,
      commissionPaise: 20000,
      feesPaise: 0,
      refundsPaise: 0,
      adjustmentsPaise: 0,
      netPayablePaise: 180000,
      eligibleAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const result = await initiateRazorpayTransferForSettlement(String(settlement._id));

    expect(result.outcome).toBe('HELD');
    expect(result.reason).toBe('MULTI_ORDER_SETTLEMENT_UNSUPPORTED');
    expect(razorpay.payments.transfer).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Idempotency
// ---------------------------------------------------------------------------

describe('initiateRazorpayTransferForSettlement — idempotency', () => {
  it('is a no-op the second time a transfer already exists', async () => {
    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    razorpay.payments.transfer.mockResolvedValue({ items: [{ id: 'trf_idem1' }] });

    const first = await initiateRazorpayTransferForSettlement(String(settlement._id));
    expect(first.outcome).toBe('TRANSFER_CREATED');
    expect(razorpay.payments.transfer).toHaveBeenCalledTimes(1);

    const second = await initiateRazorpayTransferForSettlement(String(settlement._id));
    expect(second.outcome).toBe('ALREADY_EXISTS');
    expect(razorpay.payments.transfer).toHaveBeenCalledTimes(1); // unchanged

    const payouts = await Payout.find({ settlement: settlement._id });
    expect(payouts.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 8. Concurrent release ticks — only one actually releases
// ---------------------------------------------------------------------------

describe('releaseSinglePayout — concurrent claim', () => {
  it('only one of two concurrent release attempts calls releaseTransfer', async () => {
    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    razorpay.payments.transfer.mockResolvedValue({ items: [{ id: 'trf_race1' }] });
    const initiated = await initiateRazorpayTransferForSettlement(String(settlement._id));
    expect(initiated.outcome).toBe('TRANSFER_CREATED');

    razorpay.transfers.edit.mockResolvedValue({ id: 'trf_race1', on_hold: false });

    const payout = await Payout.findOne({ settlement: settlement._id }).populate('settlement');

    // Both "ticks" start from the SAME in-memory payout doc (status
    // PROCESSING), exactly like the cron's tick and the admin's manual
    // release both reading the same Payout independently. The race is
    // decided by the atomic findOneAndUpdate status-guard inside
    // payoutService.settlePayoutStatus, not by any artificial timing here.
    const [result1, result2] = await Promise.all([
      releaseSinglePayout(payout),
      releaseSinglePayout(payout),
    ]);

    const outcomes = [result1, result2].map((r) => r.outcome).sort();
    // One wins (RELEASED), the other loses the atomic claim (CLAIM_LOST).
    expect(outcomes).toEqual(['CLAIM_LOST', 'RELEASED']);
    expect(razorpay.transfers.edit).toHaveBeenCalledTimes(1);

    const fresh = await Payout.findById(payout._id);
    expect(fresh.status).toBe('RELEASED');
  });
});

// ---------------------------------------------------------------------------
// 9. MANUAL mode — no auto-release
// ---------------------------------------------------------------------------

describe('release job — MANUAL settlement mode', () => {
  it('does not auto-release even when eligibleAt has passed', async () => {
    await AccountingConfig.create({ key: 'GLOBAL', sellerSettlementMode: 'MANUAL' });

    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    // force:true bypasses only the AUTO-mode gate on CREATION — used here just
    // to get a PROCESSING payout in place to test the job's own MANUAL-mode
    // gate on RELEASE.
    razorpay.payments.transfer.mockResolvedValue({ items: [{ id: 'trf_manual1' }] });
    await initiateRazorpayTransferForSettlement(String(settlement._id), { force: true });

    const result = await runOnce();
    expect(result).toBeNull(); // job short-circuits entirely in MANUAL mode
    expect(razorpay.transfers.edit).not.toHaveBeenCalled();

    const payout = await Payout.findOne({ settlement: settlement._id });
    expect(payout.status).toBe('PROCESSING');
  });

  it('does not even create a transfer in MANUAL mode without force', async () => {
    await AccountingConfig.create({ key: 'GLOBAL', sellerSettlementMode: 'MANUAL' });

    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    const result = await initiateRazorpayTransferForSettlement(String(settlement._id));
    expect(result.outcome).toBe('SKIPPED_MANUAL_MODE');
    expect(razorpay.payments.transfer).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 13/14. Refund scenarios B and C
// ---------------------------------------------------------------------------

describe('refundService — Razorpay Route refund scenarios', () => {
  async function approvedRequestFor(order, refundAmount = 500) {
    const request = await ReturnRequest.create({
      user: order.user,
      order: order._id,
      product: order.items[0].product,
      productName: 'Test Product',
      requestType: 'REFUND',
      reason: 'Damaged',
      status: 'PENDING',
      refundAmount,
    });
    // decideReturnRefund needs a Customer to credit — create one matching
    // order.user so postWallet credit doesn't throw uncaught outside the
    // try/catch it's wrapped in.
    const Customer = require('../Models/Customer');
    const mobileSuffix = uniqueSuffix().slice(-9).padStart(9, '0');
    await Customer.create({ _id: order.user, name: 'Test Customer', mobileNumber: `9${mobileSuffix}`, isActive: true });
    return request;
  }

  it('Scenario B: refund approved while Payout is PROCESSING reverses the transfer and holds the settlement', async () => {
    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    razorpay.payments.transfer.mockResolvedValue({ items: [{ id: 'trf_scenb' }] });
    const initiated = await initiateRazorpayTransferForSettlement(String(settlement._id));
    expect(initiated.outcome).toBe('TRANSFER_CREATED');

    razorpay.transfers.reverse.mockResolvedValue({ id: 'rev_1' });

    const request = await approvedRequestFor(order, 500);

    const result = await refundService.decideReturnRefund({
      requestId: String(request._id),
      decision: 'APPROVED',
      admin: { _id: null, name: 'SYSTEM_TEST' },
    });
    expect(result.ok).toBe(true);

    // The whole held transfer, not just the ₹500 refund — the batch is
    // re-generated from the ledger, so nothing of the old transfer may stay.
    expect(razorpay.transfers.reverse).toHaveBeenCalledWith('trf_scenb', { amount: 90000 });

    const payout = await Payout.findOne({ settlement: settlement._id });
    expect(payout.status).toBe('FAILED');
    expect(payout.failureReason).toBe('REFUND_BEFORE_RELEASE');

    const freshSettlement = await Settlement.findById(settlement._id);
    expect(freshSettlement.status).toBe('ON_HOLD');
    expect(freshSettlement.holdReason).toBe('REFUND_BEFORE_RELEASE');
  });

  it('Scenario C: refund approved while Payout is RELEASED does not reverse, but records a recovery adjustment', async () => {
    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    razorpay.payments.transfer.mockResolvedValue({ items: [{ id: 'trf_scenc' }] });
    await initiateRazorpayTransferForSettlement(String(settlement._id));

    razorpay.transfers.edit.mockResolvedValue({ id: 'trf_scenc', on_hold: false });
    const payout = await Payout.findOne({ settlement: settlement._id }).populate('settlement');
    const released = await releaseSinglePayout(payout);
    expect(released.outcome).toBe('RELEASED');

    const request = await approvedRequestFor(order, 500);

    const result = await refundService.decideReturnRefund({
      requestId: String(request._id),
      decision: 'APPROVED',
      admin: { _id: null, name: 'SYSTEM_TEST' },
    });
    expect(result.ok).toBe(true);

    expect(razorpay.transfers.reverse).not.toHaveBeenCalled();

    const freshVendor = await Vendor.findById(vendor._id);
    expect(freshVendor.razorpay.pendingRecoveryPaise).toBe(50000);

    const AccountingTransaction = require('../Models/AccountingTransaction');
    const adjustmentRow = await AccountingTransaction.findOne({ type: 'ADJUSTMENT', vendor: vendor._id });
    expect(adjustmentRow).toBeTruthy();

    const freshPayout = await Payout.findById(payout._id);
    expect(freshPayout.status).toBe('RELEASED'); // untouched by Scenario C
  });
});

// ---------------------------------------------------------------------------
// 15. Admin manual release in MANUAL mode with force
// ---------------------------------------------------------------------------

describe('admin manual release — MANUAL mode with force', () => {
  it('creates and releases a transfer via releaseSettlementTransfer-equivalent flow', async () => {
    await AccountingConfig.create({ key: 'GLOBAL', sellerSettlementMode: 'MANUAL' });

    const vendor = await createActiveVendor();
    const order = await createPaidOrder(vendor._id);
    const settlement = await createEligibleSettlement({ vendor, order, product: order.items[0].product });

    razorpay.payments.transfer.mockResolvedValue({ items: [{ id: 'trf_manrel' }] });
    razorpay.transfers.edit.mockResolvedValue({ id: 'trf_manrel', on_hold: false });

    // Mirrors adminSettlementController.releaseSettlementTransfer's own logic:
    // no existing Route payout -> initiate with force -> releaseSinglePayout.
    const initiated = await initiateRazorpayTransferForSettlement(String(settlement._id), { force: true });
    expect(initiated.outcome).toBe('TRANSFER_CREATED');

    const withSettlement = await Payout.findById(initiated.payout._id).populate('settlement');
    const released = await releaseSinglePayout(withSettlement);

    expect(released.ok).toBe(true);
    expect(released.outcome).toBe('RELEASED');
    expect(razorpay.transfers.edit).toHaveBeenCalledWith('trf_manrel', { on_hold: false });

    const payout = await Payout.findById(initiated.payout._id);
    expect(payout.status).toBe('RELEASED');
  });
});
