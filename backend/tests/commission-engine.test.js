jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const razorpay = require('../Config/razorpay');

const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const Settlement = require('../Models/Settlement');
const CommissionRule = require('../Models/CommissionRule');
const AccountingTransaction = require('../Models/AccountingTransaction');
const AccountingConfig = require('../Models/AccountingConfig');
const AdminAuditLog = require('../Models/AdminAuditLog');
const ReturnRequest = require('../Models/ReturnRequest');
const { resolveForLine, explainChain, loadRules } = require('../services/commissionResolver');
const { migrateVendorRates } = require('../services/sellerCommissionRate');

const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createVendor,
  createCategory,
  createProduct,
  createAddress,
  uniqueSuffix,
} = require('./helpers');

// The commission engine end to end: which rule wins, what it is charged on,
// that the charge is frozen at the ORDER date, and that every screen reading
// it (seller earnings, preview, summary) agrees with the ledger.

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.clearAllMocks());

beforeEach(async () => {
  await Promise.all([
    AccountingTransaction.deleteMany({}),
    Settlement.deleteMany({}),
    CommissionRule.deleteMany({}),
    Order.deleteMany({}),
    AccountingConfig.deleteMany({}),
  ]);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function seller(overrides = {}) {
  return createVendor({ verificationStatus: 'APPROVED', ...overrides });
}

async function adminAgent() {
  const { token } = await createAdmin();
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (path, query) => auth(request(app).get(path)).query(query || {}),
    post: (path, body) => auth(request(app).post(path)).send(body || {}),
    patch: (path, body) => auth(request(app).patch(path)).send(body || {}),
  };
}

async function buyer() {
  const { user, token } = await createCustomer();
  const address = await createAddress(user._id);
  return { user, token, address };
}

const addToCart = (token, productId, quantity = 1) =>
  request(app).post('/user/cart/items').set('Authorization', `Bearer ${token}`).send({ productId, quantity });

async function checkout({ token, address, method = 'RAZORPAY', total = 0 }) {
  const body = { addressId: address._id.toString(), paymentMethod: method };
  if (method === 'RAZORPAY') {
    const razorpayOrderId = `order_${uniqueSuffix()}`;
    const razorpayPaymentId = `pay_${uniqueSuffix()}`;
    razorpay.payments.fetch.mockResolvedValue({
      order_id: razorpayOrderId,
      status: 'captured',
      amount: Math.round(total * 100),
    });
    Object.assign(body, {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex'),
    });
  }
  const res = await request(app).post('/user/orders').set('Authorization', `Bearer ${token}`).send(body);
  expect(res.status).toBe(201);
  return res.body.data.id;
}

// One buyer, one cart, one order.
async function order(lines, { method = 'RAZORPAY' } = {}) {
  const b = await buyer();
  let total = 0;
  for (const { product, quantity = 1 } of lines) {
    await addToCart(b.token, product._id.toString(), quantity);
    total += product.price * quantity;
  }
  return checkout({ ...b, method, total });
}

async function deliver(orderId) {
  await Order.updateOne(
    { _id: orderId },
    { $set: { status: 'DELIVERED', deliveredAt: new Date(), 'items.$[].status': 'DELIVERED' } }
  );
}

const commissionRows = (orderId) => AccountingTransaction.find({ order: orderId, type: 'COMMISSION' }).lean();
const commissionOf = async (orderId) => (await commissionRows(orderId)).reduce((sum, row) => sum + row.debit, 0);

const rule = (overrides) =>
  CommissionRule.create({ name: `${overrides.scope} rule`, type: 'PERCENTAGE', priority: 0, isActive: true, ...overrides });

// ---------------------------------------------------------------------------
// The resolver on its own — the hierarchy with no database in the way
// ---------------------------------------------------------------------------

describe('resolver hierarchy', () => {
  const config = { defaultCommissionPercent: 12 };
  const ids = { vendorId: 'v1', categoryId: 'c1', productId: 'p1' };
  const all = [
    { _id: 'r-p', scope: 'PRODUCT', product: 'p1', type: 'PERCENTAGE', value: 5, priority: 0 },
    { _id: 'r-s', scope: 'SELLER', vendor: 'v1', type: 'PERCENTAGE', value: 7, priority: 0 },
    { _id: 'r-c', scope: 'CATEGORY', category: 'c1', type: 'PERCENTAGE', value: 10, priority: 0 },
    { _id: 'r-g', scope: 'GLOBAL', type: 'PERCENTAGE', value: 11, priority: 0 },
  ];
  const without = (...scopes) => all.filter((r) => !scopes.includes(r.scope));
  const charge = (rules, extra = {}) => resolveForLine({ basePaise: 100000, ...ids, ...extra }, rules, config);

  it('picks Product > Seller > Category > Global > platform default', () => {
    expect(charge(all)).toMatchObject({ amountPaise: 5000, ratePercent: 5 });
    expect(charge(all).rule.scope).toBe('PRODUCT');

    // Seller fallback.
    expect(charge(without('PRODUCT')).rule.scope).toBe('SELLER');
    expect(charge(without('PRODUCT')).amountPaise).toBe(7000);

    // Category fallback.
    expect(charge(without('PRODUCT', 'SELLER')).rule.scope).toBe('CATEGORY');
    expect(charge(without('PRODUCT', 'SELLER')).amountPaise).toBe(10000);

    // Global fallback.
    expect(charge(without('PRODUCT', 'SELLER', 'CATEGORY')).rule.scope).toBe('GLOBAL');

    // Nothing at all: the platform default, never zero-by-accident.
    const fallback = charge([]);
    expect(fallback).toMatchObject({ amountPaise: 12000, source: 'PLATFORM_DEFAULT', rule: null });
  });

  it('never reads a legacy vendor rate any more', () => {
    const result = charge([], { vendorRatePercent: 3 });
    expect(result.amountPaise).toBe(12000);
    expect(result.source).toBe('PLATFORM_DEFAULT');
  });

  it('treats an explicit 0% rule as "no commission", not as "no rule"', () => {
    const zero = charge([{ ...all[0], value: 0 }, ...without('PRODUCT')]);
    expect(zero.amountPaise).toBe(0);
    expect(zero.rule.scope).toBe('PRODUCT');
    expect(zero.source).toBe('RULE');
  });

  it('charges a FIXED rule per unit, capped at the line', () => {
    const fixed = [{ _id: 'f', scope: 'SELLER', vendor: 'v1', type: 'FIXED', value: 50, priority: 0 }];
    // ₹50 × 3 units.
    expect(charge(fixed, { quantity: 3, basePaise: 300000 }).amountPaise).toBe(15000);
    // ₹50 × 3 on a ₹120 line never exceeds the line.
    expect(charge(fixed, { quantity: 3, basePaise: 12000 }).amountPaise).toBe(12000);
    // No quantity given (older callers) is one unit.
    expect(charge(fixed).amountPaise).toBe(5000);
  });

  it('explains the whole chain and marks what applied', () => {
    const chain = explainChain(ids, without('PRODUCT'), config);
    expect(chain.map((step) => step.scope)).toEqual(['PRODUCT', 'SELLER', 'CATEGORY', 'GLOBAL', 'DEFAULT']);
    expect(chain.find((step) => step.applies).scope).toBe('SELLER');
    expect(chain[0]).toMatchObject({ value: null, applies: false });
    expect(chain[4]).toMatchObject({ value: 12, applies: false });

    // A higher priority beats specificity, and the chain says so.
    const promoted = explainChain(ids, [...without('PRODUCT'), { ...all[2], priority: 5 }], config);
    expect(promoted.find((step) => step.applies).scope).toBe('CATEGORY');
  });
});

describe('which rules are in force', () => {
  it('skips inactive rules and rules outside their dates', async () => {
    const vendor = (await seller()).vendor;
    await rule({ scope: 'SELLER', vendor: vendor._id, value: 2, isActive: false, name: 'Retired' });
    await rule({
      scope: 'GLOBAL',
      value: 3,
      name: 'Autumn promo',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-31'),
    });

    const before = await loadRules({ vendorIds: [vendor._id], at: new Date('2026-09-15') });
    expect(before).toHaveLength(0);

    const during = await loadRules({ vendorIds: [vendor._id], at: new Date('2026-10-15') });
    expect(during.map((r) => r.name)).toEqual(['Autumn promo']);

    const after = await loadRules({ vendorIds: [vendor._id], at: new Date('2026-11-15') });
    expect(after).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Posting — what actually lands on the ledger
// ---------------------------------------------------------------------------

describe('commission posted on real orders', () => {
  it('charges a FIXED rule × quantity and snapshots the working', async () => {
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    await rule({ scope: 'PRODUCT', product: product._id, type: 'FIXED', value: 50 });

    const orderId = await order([{ product, quantity: 3 }]);
    const [row] = await commissionRows(orderId);

    expect(row.debit).toBe(15000);
    expect(row.metadata).toMatchObject({ ruleScope: 'PRODUCT', ruleType: 'FIXED', ruleValue: 50, quantity: 3 });
  });

  it('charges each seller in one order by that seller’s own rule', async () => {
    const a = (await seller()).vendor;
    const b = (await seller()).vendor;
    const category = await createCategory();
    const productA = await createProduct({ price: 1000, stock: 10, vendor: a._id, category: category._id });
    const productB = await createProduct({ price: 2000, stock: 10, vendor: b._id, category: category._id });
    await rule({ scope: 'SELLER', vendor: a._id, value: 5 });
    await rule({ scope: 'CATEGORY', category: category._id, value: 8 });

    const orderId = await order([{ product: productA }, { product: productB }]);
    const rows = await commissionRows(orderId);
    const forVendor = (v) => rows.find((row) => String(row.vendor) === String(v._id));

    // A: own 5% SELLER rule beats the category. B: no seller rule, so 8%.
    expect(forVendor(a)).toMatchObject({ debit: 5000 });
    expect(forVendor(a).metadata.ruleScope).toBe('SELLER');
    expect(forVendor(b)).toMatchObject({ debit: 16000 });
    expect(forVendor(b).metadata.ruleScope).toBe('CATEGORY');
  });

  it('keeps the rate an order was charged when the rule changes afterwards', async () => {
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const sellerRule = await rule({ scope: 'SELLER', vendor: vendor._id, value: 10 });

    const first = await order([{ product }]);
    await CommissionRule.updateOne({ _id: sellerRule._id }, { $set: { value: 15 } });
    const second = await order([{ product }]);

    expect(await commissionOf(first)).toBe(10000);
    expect(await commissionOf(second)).toBe(15000);
  });

  it('prices a COD order at the rule in force when it was PLACED, not when the cash was remitted', async () => {
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 2000, stock: 10, vendor: vendor._id });
    const api = await adminAgent();

    // Placed at the platform default of 10%.
    const orderId = await order([{ product }], { method: 'COD' });

    // While the parcel is out, admin puts this seller on 20%.
    await rule({ scope: 'SELLER', vendor: vendor._id, value: 20 });

    await deliver(orderId);
    const remit = await api.post('/admin/accounting/transactions/cod-remittance', { orderId, reference: 'CR-1' });
    expect(remit.status).toBe(200);

    // 10% of 2,000 — the order's own rate — not the 20% set after it.
    expect(await commissionOf(orderId)).toBe(20000);
    const [row] = await commissionRows(orderId);
    expect(row.metadata.source).toBe('PLATFORM_DEFAULT');
  });

  it('freezes the terms on the order line at checkout, so EDITING a rule before COD remittance changes nothing', async () => {
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const api = await adminAgent();
    const sellerRule = await rule({ scope: 'SELLER', vendor: vendor._id, value: 8 });

    const orderId = await order([{ product, quantity: 2 }], { method: 'COD' });
    const placed = await Order.findById(orderId).lean();
    expect(placed.items[0].commission).toMatchObject({
      ruleId: sellerRule._id,
      scope: 'SELLER',
      type: 'PERCENTAGE',
      value: 8,
      basis: 'LINE_NET_OF_SELLER_FUNDED_DISCOUNT',
      amountPaise: 16000,
    });

    // The same rule is edited, not replaced — no date on it can tell the
    // two apart, only the frozen terms can.
    await CommissionRule.updateOne({ _id: sellerRule._id }, { $set: { value: 25 } });
    await deliver(orderId);
    await api.post('/admin/accounting/transactions/cod-remittance', { orderId });

    const [row] = await commissionRows(orderId);
    expect(row.debit).toBe(16000);
    expect(row.metadata).toMatchObject({ ruleId: String(sellerRule._id), ruleValue: 8, frozenAtCheckout: true });
  });

  it('prices an order from before snapshots existed against the rules as of its order date', async () => {
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const placedAt = new Date('2026-03-10');
    await rule({ scope: 'SELLER', vendor: vendor._id, value: 4, name: 'Old', endDate: new Date('2026-04-01') });
    await rule({ scope: 'SELLER', vendor: vendor._id, value: 9, name: 'New', startDate: new Date('2026-04-02') });

    const legacy = await Order.create({
      user: (await createCustomer()).user._id,
      items: [{ product: product._id, name: product.name, price: 1000, quantity: 1, vendor: vendor._id }],
      shippingAddress: { fullName: 'B', phone: '9', line1: 'l', city: 'c', state: 's', pincode: '123456' },
      subtotal: 1000,
      total: 1000,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PAID',
      createdAt: placedAt,
    });
    expect(legacy.items[0].commission).toBeNull();

    await require('../services/accountingPosting').postOrderSale(legacy._id);
    expect(await commissionOf(legacy._id)).toBe(4000);
  });

  it('ignores the legacy Vendor.commissionRatePercent', async () => {
    const vendor = (await seller({ commissionRatePercent: 3 })).vendor;
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });

    const orderId = await order([{ product }]);
    expect(await commissionOf(orderId)).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// The seller's view agrees with the ledger
// ---------------------------------------------------------------------------

describe('seller earnings read the ledger', () => {
  const earnings = (token, path) =>
    request(app).get(`/vendor/earnings/${path}`).set('Authorization', `Bearer ${token}`);

  it('shows the commission that was charged, even after the rule changes', async () => {
    const { vendor, token } = await seller();
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const sellerRule = await rule({ scope: 'SELLER', vendor: vendor._id, value: 10 });

    const orderId = await order([{ product, quantity: 2 }]);
    await deliver(orderId);

    // Admin raises the rate after the order was charged.
    await CommissionRule.updateOne({ _id: sellerRule._id }, { $set: { value: 25 } });

    const list = await earnings(token, 'transactions');
    expect(list.status).toBe(200);
    const [line] = list.body.data.items;
    expect(line).toMatchObject({
      state: 'UNSETTLED',
      grossAmount: 200000,
      commission: 20000,
      netAmount: 180000,
      estimated: false,
    });
    expect(line.commission).toBe(await commissionOf(orderId));

    const summary = await earnings(token, 'summary');
    expect(summary.body.data).toMatchObject({
      totalSales: 200000,
      totalCommission: 20000,
      unsettledAmount: 180000,
      estimatedAmount: 0,
      // The headline rate is the rule as it stands now.
      commissionRatePercent: 25,
    });
  });

  it('estimates an unremitted COD line at its order-date rule, then matches the ledger once posted', async () => {
    const { vendor, token } = await seller();
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const api = await adminAgent();

    const orderId = await order([{ product }], { method: 'COD' });
    await rule({ scope: 'SELLER', vendor: vendor._id, value: 30 });
    await deliver(orderId);

    let [line] = (await earnings(token, 'transactions')).body.data.items;
    // Not on the ledger yet, so estimated — at the 10% in force when placed.
    expect(line).toMatchObject({ commission: 10000, netAmount: 90000, estimated: true });

    await api.post('/admin/accounting/transactions/cod-remittance', { orderId });
    [line] = (await earnings(token, 'transactions')).body.data.items;
    expect(line).toMatchObject({ commission: 10000, estimated: false });
    expect(await commissionOf(orderId)).toBe(10000);
  });

  it('nets a refund’s commission reversal out of the unsettled line', async () => {
    const { vendor, token } = await seller();
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const orderId = await order([{ product, quantity: 4 }]);
    await deliver(orderId);

    // ₹1,000 of the ₹4,000 line refunded, posted the way the refund flow does.
    const placed = await Order.findById(orderId).lean();
    const returnRequest = await ReturnRequest.create({
      user: placed.user,
      order: orderId,
      product: product._id,
      productName: product.name,
      requestType: 'REFUND',
      reason: 'One unit faulty',
      refundAmount: 1000,
    });
    await require('../services/accountingPosting').postReturnRefund({ returnRequest: returnRequest.toObject() });

    const [line] = (await earnings(token, 'transactions')).body.data.items;
    // 400 charged, a quarter (100) handed back.
    expect(line.commission).toBe(30000);
    // 4,000 - 400 + 100 - 1,000 refunded.
    expect(line.netAmount).toBe(270000);
  });
});

// ---------------------------------------------------------------------------
// Preview API
// ---------------------------------------------------------------------------

describe('commission preview', () => {
  it('previews through the same resolver and base as posting, with the chain', async () => {
    const api = await adminAgent();
    const vendor = (await seller()).vendor;
    const category = await createCategory();
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id, category: category._id });
    await rule({ scope: 'CATEGORY', category: category._id, value: 10 });
    const sellerRule = await rule({ scope: 'SELLER', vendor: vendor._id, value: 8 });

    const res = await api.post('/admin/accounting/commissions/preview', {
      productId: product._id.toString(),
      sellingPrice: 1000,
      discount: 100,
      quantity: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      grossAmount: 100000,
      discount: 10000,
      // Seller-funded discount lowers the base under the default basis.
      commissionBasis: 'LINE_NET_OF_SELLER_FUNDED_DISCOUNT',
      commissionBase: 90000,
      commissionType: 'PERCENTAGE',
      commissionRate: 8,
      commissionAmount: 7200,
      source: 'SELLER',
      ruleId: String(sellerRule._id),
      sellerPayable: 82800,
    });
    const chain = res.body.data.chain;
    expect(chain.map((s) => [s.scope, s.value, s.applies])).toEqual([
      ['PRODUCT', null, false],
      ['SELLER', 8, true],
      ['CATEGORY', 10, false],
      ['GLOBAL', null, false],
      ['DEFAULT', 10, false],
    ]);

    // A platform-funded discount does not lower the base.
    const platformFunded = await api.post('/admin/accounting/commissions/preview', {
      productId: product._id.toString(),
      sellingPrice: 1000,
      discount: 100,
      discountFundedBy: 'PLATFORM',
    });
    expect(platformFunded.body.data).toMatchObject({ commissionBase: 100000, commissionAmount: 8000, sellerPayable: 92000 });
  });

  it('previews a FIXED rule per unit', async () => {
    const api = await adminAgent();
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    await rule({ scope: 'PRODUCT', product: product._id, type: 'FIXED', value: 50 });

    const res = await api.post('/admin/accounting/commissions/preview', { productId: product._id.toString(), quantity: 3 });
    expect(res.body.data).toMatchObject({ commissionType: 'FIXED', commissionRate: null, commissionValue: 50, commissionAmount: 15000 });
  });

  it('rejects bad input, and a platform-owned product', async () => {
    const api = await adminAgent();
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const own = await createProduct({ price: 1000, stock: 10 });
    const preview = (body) => api.post('/admin/accounting/commissions/preview', body);

    expect((await preview({})).status).toBe(400);
    expect((await preview({ productId: 'nope' })).status).toBe(400);
    expect((await preview({ productId: product._id.toString(), quantity: 0 })).status).toBe(400);
    expect((await preview({ productId: product._id.toString(), sellingPrice: 'NaN' })).status).toBe(400);
    expect((await preview({ productId: product._id.toString(), sellingPrice: 100, discount: 200 })).status).toBe(400);
    expect((await preview({ productId: product._id.toString(), discount: -1 })).status).toBe(400);
    expect((await preview({ productId: own._id.toString() })).status).toBe(400);
  });

  it('writes nothing — no rule, no ledger row, no audit entry', async () => {
    const api = await adminAgent();
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const auditsBefore = await AdminAuditLog.countDocuments({});

    const res = await api.post('/admin/accounting/commissions/preview', { productId: product._id.toString() });
    expect(res.status).toBe(200);
    // The audit middleware writes after the response finishes.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(await AdminAuditLog.countDocuments({})).toBe(auditsBefore);
    expect(await CommissionRule.countDocuments({})).toBe(0);
    expect(await AccountingTransaction.countDocuments({})).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------------

describe('commission summary', () => {
  it('splits commission into pending, earned, reversed and cancelled, straight off the ledger', async () => {
    const api = await adminAgent();
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 1000, stock: 20, vendor: vendor._id });

    // In transit: 100 pending.
    await order([{ product }]);
    // Delivered: 200 earned.
    const delivered = await order([{ product, quantity: 2 }]);
    await deliver(delivered);
    // Cancelled before shipping: 300 charged, 300 handed back.
    const cancelled = await order([{ product, quantity: 3 }]);
    expect((await api.patch(`/admin/orders/${cancelled}/status`, { status: 'CANCELLED' })).status).toBe(200);

    const res = await api.get('/admin/accounting/commissions/summary');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalCharged: 60000,
      pending: 10000,
      earned: 20000,
      cancelled: 30000,
      reversed: 0,
      netCommission: 30000,
      thisMonth: 30000,
      lastMonth: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// One source of truth for a seller's rate
// ---------------------------------------------------------------------------

describe('seller rate lives only in CommissionRule', () => {
  it('the older Finance screen writes a SELLER rule, and the ledger charges it', async () => {
    const api = await adminAgent();
    const vendor = (await seller()).vendor;
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });

    const set = await api.patch(`/admin/finance/commission-rules/${vendor._id}`, { value: 6 });
    expect(set.status).toBe(200);
    // Setting it again updates the same rule rather than stacking a second.
    expect((await api.patch(`/admin/finance/commission-rules/${vendor._id}`, { value: 7 })).status).toBe(200);

    const rules = await CommissionRule.find({ scope: 'SELLER', vendor: vendor._id }).lean();
    expect(rules).toHaveLength(1);
    expect(rules[0].value).toBe(7);
    // The legacy field is not touched.
    expect((await Vendor.findById(vendor._id).lean()).commissionRatePercent).toBe(10);

    const list = await api.get('/admin/finance/commission-rules');
    expect(list.body.data.items.find((row) => row.id === String(vendor._id))).toMatchObject({ value: 7, source: 'SELLER' });

    const orderId = await order([{ product }]);
    expect(await commissionOf(orderId)).toBe(7000);
  });

  it('the Finance "default" row sets the platform default', async () => {
    const api = await adminAgent();
    const res = await api.patch('/admin/finance/commission-rules/default', { value: 12 });
    expect(res.status).toBe(200);
    expect((await AccountingConfig.resolve()).defaultCommissionPercent).toBe(12);

    const tooHigh = await api.patch('/admin/finance/commission-rules/default', { value: 90 });
    expect(tooHigh.status).toBe(400);
  });

  it('migrates non-default legacy rates into SELLER rules, once', async () => {
    const negotiated = (await seller({ commissionRatePercent: 6 })).vendor;
    const atDefault = (await seller({ commissionRatePercent: 10 })).vendor;
    const alreadyRuled = (await seller({ commissionRatePercent: 4 })).vendor;
    await rule({ scope: 'SELLER', vendor: alreadyRuled._id, value: 9 });

    const dryRun = await migrateVendorRates({ apply: false });
    expect(dryRun.created.map((row) => row.vendorId)).toContain(String(negotiated._id));
    expect(await CommissionRule.countDocuments({ vendor: negotiated._id })).toBe(0);

    const applied = await migrateVendorRates({ apply: true });
    expect(applied.created.map((row) => row.vendorId)).toContain(String(negotiated._id));
    expect(applied.created.map((row) => row.vendorId)).not.toContain(String(atDefault._id));
    expect(applied.created.map((row) => row.vendorId)).not.toContain(String(alreadyRuled._id));

    const migrated = await CommissionRule.findOne({ scope: 'SELLER', vendor: negotiated._id }).lean();
    expect(migrated).toMatchObject({ type: 'PERCENTAGE', value: 6, priority: 0, isActive: true });
    // The pre-existing rule is untouched.
    expect((await CommissionRule.findOne({ vendor: alreadyRuled._id }).lean()).value).toBe(9);

    const again = await migrateVendorRates({ apply: true });
    expect(again.created.map((row) => row.vendorId)).not.toContain(String(negotiated._id));
    expect(await CommissionRule.countDocuments({ vendor: negotiated._id })).toBe(1);
  });
});
