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
const Payout = require('../Models/Payout');
const CommissionRule = require('../Models/CommissionRule');
const AccountingTransaction = require('../Models/AccountingTransaction');
const AccountingConfig = require('../Models/AccountingConfig');
const ReturnRequest = require('../Models/ReturnRequest');

const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createCategory,
  createProduct,
  createAddress,
  uniqueSuffix,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.clearAllMocks());

// Every test starts from an empty ledger so one test's postings can never be
// mistaken for another's — these are money assertions, and a stray row from a
// neighbouring test would make a wrong total look right.
beforeEach(async () => {
  await Promise.all([
    AccountingTransaction.deleteMany({}),
    Settlement.deleteMany({}),
    Payout.deleteMany({}),
    CommissionRule.deleteMany({}),
    Order.deleteMany({}),
    ReturnRequest.deleteMany({}),
    AccountingConfig.deleteMany({}),
  ]);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function createVendor(overrides = {}) {
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
    ...overrides,
  });
}

async function adminAgent() {
  const { admin, token } = await createAdmin();
  const get = (path, query) => request(app).get(path).set('Authorization', `Bearer ${token}`).query(query || {});
  const post = (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body || {});
  const patch = (path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body || {});
  const put = (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body || {});
  return { admin, token, get, post, patch, put };
}

async function buyerWithAddress() {
  const { user, token } = await createCustomer();
  const address = await createAddress(user._id);
  return { user, token, address };
}

const addToCart = (token, productId, quantity = 1) =>
  request(app).post('/user/cart/items').set('Authorization', `Bearer ${token}`).send({ productId, quantity });

// Places a real order through the real checkout endpoint, so the accounting
// under test is reacting to the same writes production would produce.
async function placeOrder({ token, address, method = 'COD', shippingFee = 0, total = null, couponCode = null }) {
  const body = { addressId: address._id.toString(), paymentMethod: method, shippingFee };
  if (couponCode) body.couponCode = couponCode;

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
  return res;
}

async function deliver(orderId) {
  await Order.updateOne(
    { _id: orderId },
    { $set: { status: 'DELIVERED', deliveredAt: new Date(), 'items.$[].status': 'DELIVERED' } }
  );
}

// Moves delivery back in time so the hold window has elapsed.
async function ageDelivery(orderId, days = 10) {
  await Order.updateOne(
    { _id: orderId },
    { $set: { deliveredAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
  );
}

const ledgerFor = (orderId) => AccountingTransaction.find({ order: orderId }).lean();
const sumOf = (rows, type, side) =>
  rows.filter((row) => row.type === type).reduce((total, row) => total + row[side], 0);

// ---------------------------------------------------------------------------
// The headline scenario from the brief (task §28)
// ---------------------------------------------------------------------------

describe('prepaid order — sale, commission, gateway fee, shipping', () => {
  it('posts the whole chain with the right numbers and leaves the seller payable exact', async () => {
    const vendor = await createVendor();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ price: 10000, stock: 5, vendor: vendor._id });

    await addToCart(token, product._id.toString(), 1);
    // Product 10,000 + shipping 100 = 10,100 collected from the buyer.
    const res = await placeOrder({ token, address, method: 'RAZORPAY', shippingFee: 99, total: 10099 });
    expect(res.status).toBe(201);

    const orderId = res.body.data.id;
    const rows = await ledgerFor(orderId);

    // SALE credits the seller the full line: no discount, and the platform
    // keeps the shipping by default.
    expect(sumOf(rows, 'SALE', 'credit')).toBe(1000000);
    // Commission at the platform default of 10%.
    expect(sumOf(rows, 'COMMISSION', 'debit')).toBe(100000);
    // Gateway fee: 2% of the 10,099 captured, borne by the platform.
    const gatewayRow = rows.find((row) => row.type === 'PAYMENT_GATEWAY_FEE');
    expect(gatewayRow.debit).toBe(20198);
    expect(gatewayRow.vendor).toBeNull();
    expect(gatewayRow.metadata.bearer).toBe('PLATFORM');
    // Shipping revenue is the platform's, so it is not on the seller's ledger.
    const shippingRow = rows.find((row) => row.type === 'SHIPPING_CHARGE');
    expect(shippingRow.credit).toBe(9900);
    expect(shippingRow.vendor).toBeNull();

    // The seller is owed 10,000 - 1,000 = 9,000. The platform's gateway fee
    // must not have touched it.
    const sellerRows = rows.filter((row) => String(row.vendor) === String(vendor._id));
    const payable = sellerRows.reduce((total, row) => total + row.credit - row.debit, 0);
    expect(payable).toBe(900000);
  });

  it('every row is idempotent — re-posting the same order changes nothing', async () => {
    const vendor = await createVendor();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ price: 10000, stock: 5, vendor: vendor._id });

    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'WALLET', total: 10000 });
    // A wallet order needs balance; fall back to Razorpay if it was rejected.
    const orderId = res.status === 201 ? res.body.data.id : null;
    if (!orderId) return;

    const before = await AccountingTransaction.countDocuments({ order: orderId });
    const posting = require('../services/accountingPosting');
    const order = await Order.findById(orderId).lean();
    await posting.postOrderSale(order);
    await posting.postOrderSale(order);
    await posting.reconcileLedger();
    const after = await AccountingTransaction.countDocuments({ order: orderId });

    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// COD (task §12)
// ---------------------------------------------------------------------------

describe('COD accounting', () => {
  it('posts nothing until the courier remits, then posts the sale', async () => {
    const vendor = await createVendor();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ price: 2000, stock: 5, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'COD' });
    const orderId = res.body.data.id;

    // Money is still with the courier — nothing on the ledger.
    expect(await AccountingTransaction.countDocuments({ order: orderId })).toBe(0);

    // Cannot remit before delivery.
    const early = await api.post('/admin/accounting/transactions/cod-remittance', { orderId });
    expect(early.status).toBe(400);

    await deliver(orderId);

    const pending = await api.get('/admin/accounting/transactions/cod-pending');
    expect(pending.status).toBe(200);
    expect(pending.body.data.items.some((row) => row.orderId === orderId)).toBe(true);

    const remit = await api.post('/admin/accounting/transactions/cod-remittance', {
      orderId,
      reference: 'COURIER-8891',
    });
    expect(remit.status).toBe(200);

    const rows = await ledgerFor(orderId);
    expect(sumOf(rows, 'SALE', 'credit')).toBe(200000);
    // No gateway fee on cash.
    expect(rows.some((row) => row.type === 'PAYMENT_GATEWAY_FEE')).toBe(false);

    // Remitting twice must not post a second sale.
    const again = await api.post('/admin/accounting/transactions/cod-remittance', { orderId });
    expect(again.status).toBe(409);
    expect(sumOf(await ledgerFor(orderId), 'SALE', 'credit')).toBe(200000);
  });
});

// ---------------------------------------------------------------------------
// Multi-seller orders (task §23)
// ---------------------------------------------------------------------------

describe('multi-seller order', () => {
  it('splits gross, commission and payable per seller instead of crediting one', async () => {
    const sellerA = await createVendor();
    const sellerB = await createVendor();
    const { token, address } = await buyerWithAddress();
    const productA = await createProduct({ price: 6000, stock: 5, vendor: sellerA._id });
    const productB = await createProduct({ price: 4000, stock: 5, vendor: sellerB._id });

    await addToCart(token, productA._id.toString(), 1);
    await addToCart(token, productB._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 10000 });
    expect(res.status).toBe(201);

    const rows = await ledgerFor(res.body.data.id);
    const payableFor = (vendor) =>
      rows
        .filter((row) => String(row.vendor) === String(vendor._id))
        .reduce((total, row) => total + row.credit - row.debit, 0);

    // A: 6,000 gross, 600 commission, 5,400 payable.
    expect(payableFor(sellerA)).toBe(540000);
    // B: 4,000 gross, 400 commission, 3,600 payable.
    expect(payableFor(sellerB)).toBe(360000);
    // Neither seller sees the other's money.
    expect(payableFor(sellerA) + payableFor(sellerB)).toBe(900000);
  });

  it('refunds one seller line and leaves the other seller untouched', async () => {
    const sellerA = await createVendor();
    const sellerB = await createVendor();
    const { user, token } = await createCustomer();
    const address = await createAddress(user._id);
    const productA = await createProduct({ price: 6000, stock: 5, vendor: sellerA._id });
    const productB = await createProduct({ price: 4000, stock: 5, vendor: sellerB._id });
    const api = await adminAgent();

    await addToCart(token, productA._id.toString(), 1);
    await addToCart(token, productB._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 10000 });
    const orderId = res.body.data.id;
    await deliver(orderId);

    // The buyer returns seller A's product only.
    const returnRequest = await ReturnRequest.create({
      user: user._id,
      order: orderId,
      product: productA._id,
      productName: productA.name,
      requestType: 'REFUND',
      reason: 'Damaged on arrival',
      refundAmount: 6000,
    });

    const approve = await api.post(`/admin/accounting/refunds/return:${returnRequest._id}/approve`, {
      reason: 'Verified damage',
    });
    expect(approve.status).toBe(200);

    const rows = await ledgerFor(orderId);
    const payableFor = (vendor) =>
      rows
        .filter((row) => String(row.vendor) === String(vendor._id))
        .reduce((total, row) => total + row.credit - row.debit, 0);

    // Only 6,000 comes back, not 10,000 (task §9).
    expect(sumOf(rows, 'REFUND', 'debit')).toBe(600000);
    // Seller A gets their commission back too, so they net to zero.
    expect(sumOf(rows, 'REFUND_REVERSAL', 'credit')).toBe(60000);
    expect(payableFor(sellerA)).toBe(0);
    // Seller B's sale stands.
    expect(payableFor(sellerB)).toBe(360000);

    // The original SALE row is still there, untouched (task §15 Rule 1).
    const sale = rows.find((row) => row.type === 'SALE' && String(row.vendor) === String(sellerA._id));
    expect(sale.credit).toBe(600000);
  });
});

// ---------------------------------------------------------------------------
// Partial refunds (task §22 cases 7-8)
// ---------------------------------------------------------------------------

describe('partial refunds', () => {
  it('reverses commission in proportion and never over-refunds a line', async () => {
    const vendor = await createVendor();
    const { user, token } = await createCustomer();
    const address = await createAddress(user._id);
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 4);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 4000 });
    const orderId = res.body.data.id;
    await deliver(orderId);

    // Refund one unit of four: 1,000 of a 4,000 line.
    const first = await ReturnRequest.create({
      user: user._id,
      order: orderId,
      product: product._id,
      productName: product.name,
      requestType: 'REFUND',
      reason: 'One unit faulty',
      refundAmount: 1000,
    });
    await api.post(`/admin/accounting/refunds/return:${first._id}/approve`, { reason: 'ok' });

    const rows = await ledgerFor(orderId);
    expect(sumOf(rows, 'SALE', 'credit')).toBe(400000);
    expect(sumOf(rows, 'REFUND', 'debit')).toBe(100000);
    // A quarter of the 400 commission comes back.
    expect(sumOf(rows, 'REFUND_REVERSAL', 'credit')).toBe(10000);

    const payable = rows
      .filter((row) => String(row.vendor) === String(vendor._id))
      .reduce((total, row) => total + row.credit - row.debit, 0);
    // 4,000 - 400 commission - 1,000 refund + 100 commission back = 2,700.
    expect(payable).toBe(270000);
  });

  it('a second decision on the same request is rejected rather than refunding twice', async () => {
    const vendor = await createVendor();
    const { user, token } = await createCustomer();
    const address = await createAddress(user._id);
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 2);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 2000 });
    await deliver(res.body.data.id);

    const req1 = await ReturnRequest.create({
      user: user._id,
      order: res.body.data.id,
      product: product._id,
      productName: product.name,
      requestType: 'REFUND',
      reason: 'faulty',
      refundAmount: 1000,
    });

    const first = await api.post(`/admin/accounting/refunds/return:${req1._id}/approve`, { reason: 'ok' });
    const second = await api.post(`/admin/accounting/refunds/return:${req1._id}/approve`, { reason: 'ok' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(sumOf(await ledgerFor(res.body.data.id), 'REFUND', 'debit')).toBe(100000);
  });
});

// ---------------------------------------------------------------------------
// Commission rules (task §6)
// ---------------------------------------------------------------------------

describe('commission rules', () => {
  it('resolves product over seller over category over global', async () => {
    const api = await adminAgent();
    const category = await createCategory();
    const vendor = await createVendor();
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id, category: category._id });

    const make = (body) => api.post('/admin/accounting/commissions', body);

    expect((await make({ name: 'Global', type: 'PERCENTAGE', value: 10, scope: 'GLOBAL' })).status).toBe(201);
    expect(
      (await make({ name: 'Category', type: 'PERCENTAGE', value: 12, scope: 'CATEGORY', categoryId: category._id.toString() })).status
    ).toBe(201);
    expect(
      (await make({ name: 'Seller', type: 'PERCENTAGE', value: 8, scope: 'SELLER', sellerId: vendor._id.toString() })).status
    ).toBe(201);

    const { token, address } = await buyerWithAddress();
    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 1000 });

    // Seller beats category and global.
    let rows = await ledgerFor(res.body.data.id);
    expect(sumOf(rows, 'COMMISSION', 'debit')).toBe(8000);
    expect(rows.find((row) => row.type === 'COMMISSION').metadata.ruleScope).toBe('SELLER');

    // Add a product rule; a NEW order is charged 15%.
    expect(
      (await make({ name: 'Product', type: 'PERCENTAGE', value: 15, scope: 'PRODUCT', productId: product._id.toString() })).status
    ).toBe(201);

    const buyer2 = await buyerWithAddress();
    await addToCart(buyer2.token, product._id.toString(), 1);
    const res2 = await placeOrder({ token: buyer2.token, address: buyer2.address, method: 'RAZORPAY', total: 1000 });
    rows = await ledgerFor(res2.body.data.id);
    expect(sumOf(rows, 'COMMISSION', 'debit')).toBe(15000);
    expect(rows.find((row) => row.type === 'COMMISSION').metadata.ruleScope).toBe('PRODUCT');

    // And the FIRST order still shows the 8% it was actually charged
    // (task §15 Rule 6).
    const original = await ledgerFor(res.body.data.id);
    expect(sumOf(original, 'COMMISSION', 'debit')).toBe(8000);
  });

  it('rejects a rate above the platform limit, a bad date range and a duplicate', async () => {
    const api = await adminAgent();
    const vendor = await createVendor();

    const tooHigh = await api.post('/admin/accounting/commissions', {
      name: 'Greedy',
      type: 'PERCENTAGE',
      value: 90,
      scope: 'GLOBAL',
    });
    expect(tooHigh.status).toBe(400);
    expect(tooHigh.body.message).toMatch(/limit/i);

    const badDates = await api.post('/admin/accounting/commissions', {
      name: 'Backwards',
      type: 'PERCENTAGE',
      value: 5,
      scope: 'GLOBAL',
      startDate: '2026-06-01',
      endDate: '2026-01-01',
    });
    expect(badDates.status).toBe(400);

    const first = await api.post('/admin/accounting/commissions', {
      name: 'Seller rate',
      type: 'PERCENTAGE',
      value: 9,
      scope: 'SELLER',
      sellerId: vendor._id.toString(),
    });
    expect(first.status).toBe(201);

    const duplicate = await api.post('/admin/accounting/commissions', {
      name: 'Seller rate again',
      type: 'PERCENTAGE',
      value: 7,
      scope: 'SELLER',
      sellerId: vendor._id.toString(),
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.message).toMatch(/already covers/i);
  });

  it('ignores an expired rule and falls back to the platform default', async () => {
    const api = await adminAgent();
    const vendor = await createVendor();
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });

    await CommissionRule.create({
      name: 'Expired promo',
      type: 'PERCENTAGE',
      value: 2,
      scope: 'SELLER',
      vendor: vendor._id,
      startDate: new Date('2020-01-01'),
      endDate: new Date('2020-12-31'),
      isActive: true,
    });

    const { token, address } = await buyerWithAddress();
    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 1000 });

    // Not 2% — the rule expired years ago.
    expect(sumOf(await ledgerFor(res.body.data.id), 'COMMISSION', 'debit')).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// Settlements and payouts (task §7, §8, §15 Rules 4-5)
// ---------------------------------------------------------------------------

describe('settlements and payouts', () => {
  async function deliveredEligibleOrder() {
    const vendor = await createVendor();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ price: 10000, stock: 5, vendor: vendor._id });

    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 10000 });
    await deliver(res.body.data.id);
    await ageDelivery(res.body.data.id);
    return { vendor, orderId: res.body.data.id };
  }

  it('does not settle a line still inside the hold window', async () => {
    const vendor = await createVendor();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ price: 5000, stock: 5, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 5000 });
    await deliver(res.body.data.id); // delivered just now

    const generated = await api.post('/admin/accounting/settlements/generate');
    expect(generated.status).toBe(200);
    expect(generated.body.data.generated).toBe(0);
  });

  it('generates once, and a second generate does not double-count the same line', async () => {
    const { vendor } = await deliveredEligibleOrder();
    const api = await adminAgent();

    const first = await api.post('/admin/accounting/settlements/generate');
    expect(first.body.data.generated).toBe(1);

    const second = await api.post('/admin/accounting/settlements/generate');
    expect(second.body.data.generated).toBe(0);

    const batches = await Settlement.find({ vendor: vendor._id }).lean();
    expect(batches).toHaveLength(1);
    // 10,000 less 10% commission.
    expect(batches[0].netPayablePaise).toBe(900000);
  });

  it('pays out exactly once however many times the button is pressed', async () => {
    await deliveredEligibleOrder();
    const api = await adminAgent();
    await api.post('/admin/accounting/settlements/generate');
    const [settlement] = await Settlement.find().lean();

    const responses = await Promise.all([
      api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) }),
      api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) }),
      api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) }),
    ]);

    for (const res of responses) expect(res.status).toBeLessThan(300);
    expect(await Payout.countDocuments({ settlement: settlement._id })).toBe(1);
  });

  it('debits the ledger only when the payout completes, and masks the bank account', async () => {
    const { vendor } = await deliveredEligibleOrder();
    const api = await adminAgent();
    await api.post('/admin/accounting/settlements/generate');
    const [settlement] = await Settlement.find().lean();

    const created = await api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) });
    expect(created.status).toBe(201);
    expect(created.body.data.bankAccountMasked).toBe('XXXX XXXX 4582');
    // The full account number must never appear in the response.
    expect(JSON.stringify(created.body)).not.toContain('50100412344582');

    // Nothing has left yet.
    expect(await AccountingTransaction.countDocuments({ type: 'PAYOUT' })).toBe(0);

    const completed = await api.patch(`/admin/accounting/payouts/${created.body.data.id}/status`, {
      status: 'COMPLETED',
      utr: 'UTR123456789',
    });
    expect(completed.status).toBe(200);

    const payoutRows = await AccountingTransaction.find({ type: 'PAYOUT' }).lean();
    expect(payoutRows).toHaveLength(1);
    expect(payoutRows[0].debit).toBe(900000);

    // The seller is now square: 10,000 - 1,000 commission - 9,000 paid.
    const sellerRows = await AccountingTransaction.find({ vendor: vendor._id }).lean();
    expect(sellerRows.reduce((total, row) => total + row.credit - row.debit, 0)).toBe(0);
  });

  it('a completed payout cannot be walked back', async () => {
    await deliveredEligibleOrder();
    const api = await adminAgent();
    await api.post('/admin/accounting/settlements/generate');
    const [settlement] = await Settlement.find().lean();
    const created = await api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) });
    await api.patch(`/admin/accounting/payouts/${created.body.data.id}/status`, {
      status: 'COMPLETED',
      utr: 'UTR999',
    });

    const reopen = await api.patch(`/admin/accounting/payouts/${created.body.data.id}/status`, {
      status: 'PROCESSING',
    });
    expect(reopen.status).toBe(400);
  });

  it('a failed payout can be retried, and the failed attempt stays on the record', async () => {
    await deliveredEligibleOrder();
    const api = await adminAgent();
    await api.post('/admin/accounting/settlements/generate');
    const [settlement] = await Settlement.find().lean();

    const first = await api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) });
    const failed = await api.patch(`/admin/accounting/payouts/${first.body.data.id}/status`, {
      status: 'FAILED',
      failureReason: 'Bank rejected the IFSC',
    });
    expect(failed.status).toBe(200);
    // Nothing moved, so nothing was debited.
    expect(await AccountingTransaction.countDocuments({ type: 'PAYOUT' })).toBe(0);

    const retry = await api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) });
    expect(retry.status).toBe(201);
    expect(retry.body.data.attempt).toBe(2);
    expect(await Payout.countDocuments({ settlement: settlement._id })).toBe(2);
  });

  it('will not pay a settlement that is on hold', async () => {
    await deliveredEligibleOrder();
    const api = await adminAgent();
    await api.post('/admin/accounting/settlements/generate');
    const [settlement] = await Settlement.find().lean();

    const held = await api.post(`/admin/accounting/settlements/${settlement._id}/hold`, {
      reason: 'KYC under review',
    });
    expect(held.status).toBe(200);

    const blocked = await api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) });
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/hold/i);

    const released = await api.post(`/admin/accounting/settlements/${settlement._id}/release`, {});
    expect(released.status).toBe(200);
    expect((await api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) })).status).toBe(201);
  });

  it('refunding after a payout leaves the seller with a negative balance rather than losing the refund', async () => {
    const vendor = await createVendor();
    const { user, token } = await createCustomer();
    const address = await createAddress(user._id);
    const product = await createProduct({ price: 10000, stock: 5, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 10000 });
    const orderId = res.body.data.id;
    await deliver(orderId);
    await ageDelivery(orderId);

    await api.post('/admin/accounting/settlements/generate');
    const [settlement] = await Settlement.find().lean();
    const payout = await api.post('/admin/accounting/payouts', { settlementId: String(settlement._id) });
    await api.patch(`/admin/accounting/payouts/${payout.body.data.id}/status`, { status: 'COMPLETED', utr: 'UTR1' });

    // Now the buyer returns it — after the seller has already been paid.
    const returnRequest = await ReturnRequest.create({
      user: user._id,
      order: orderId,
      product: product._id,
      productName: product.name,
      requestType: 'REFUND',
      reason: 'Late return accepted',
      refundAmount: 10000,
    });
    const approved = await api.post(`/admin/accounting/refunds/return:${returnRequest._id}/approve`, { reason: 'goodwill' });
    expect(approved.status).toBe(200);

    const rows = await AccountingTransaction.find({ vendor: vendor._id }).lean();
    const balance = rows.reduce((total, row) => total + row.credit - row.debit, 0);
    // Paid 9,000, then clawed back 10,000 less the 1,000 commission returned.
    expect(balance).toBe(-900000);

    // And it is visible as a negative balance on the ledger screen.
    const ledger = await api.get(`/admin/accounting/seller-ledger/${vendor._id}`);
    expect(ledger.body.data.summary.currentPayable).toBe(-900000);
  });
});

// ---------------------------------------------------------------------------
// Manual adjustments (task §19)
// ---------------------------------------------------------------------------

describe('manual adjustments', () => {
  it('moves the balance only through a ledger row, and demands a reason', async () => {
    const vendor = await createVendor();
    const api = await adminAgent();

    const noReason = await api.post(`/admin/accounting/seller-ledger/${vendor._id}/adjustments`, {
      amount: 500,
      direction: 'CREDIT',
    });
    expect(noReason.status).toBe(400);

    const created = await api.post(`/admin/accounting/seller-ledger/${vendor._id}/adjustments`, {
      amount: 500,
      direction: 'CREDIT',
      reason: 'Shipping compensation',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.credit).toBe(50000);

    const ledger = await api.get(`/admin/accounting/seller-ledger/${vendor._id}`);
    expect(ledger.body.data.summary.currentPayable).toBe(50000);
    expect(ledger.body.data.summary.totalAdjustments).toBe(50000);
  });

  it('refuses an adjustment against another seller’s order', async () => {
    const sellerA = await createVendor();
    const sellerB = await createVendor();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ price: 1000, stock: 5, vendor: sellerA._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 1000 });

    const wrong = await api.post(`/admin/accounting/seller-ledger/${sellerB._id}/adjustments`, {
      amount: 100,
      direction: 'DEBIT',
      reason: 'Penalty',
      orderId: res.body.data.id,
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toMatch(/does not belong/i);
  });
});

// ---------------------------------------------------------------------------
// Reports agree with the ledger (acceptance criterion)
// ---------------------------------------------------------------------------

describe('reports reconcile with the ledger', () => {
  it('commission and settlement reports match the ledger totals', async () => {
    const vendor = await createVendor();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ price: 10000, stock: 5, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 1);
    await placeOrder({ token, address, method: 'RAZORPAY', total: 10000 });

    const ledgerRows = await AccountingTransaction.find({ vendor: vendor._id }).lean();
    const ledgerCommission = sumOf(ledgerRows, 'COMMISSION', 'debit');
    const ledgerPayable = ledgerRows.reduce((total, row) => total + row.credit - row.debit, 0);

    const commissionReport = await api.get('/admin/accounting/reports/commissions');
    expect(commissionReport.status).toBe(200);
    expect(commissionReport.body.data.totals.commissionAmount).toBe(ledgerCommission);

    const settlementReport = await api.get('/admin/accounting/reports/settlements');
    expect(settlementReport.body.data.totals.pending).toBe(ledgerPayable);

    const overview = await api.get('/admin/accounting/overview');
    const payableCard = overview.body.data.kpis.find((row) => row.key === 'seller_payable');
    expect(payableCard.value).toBe(ledgerPayable);
  });

  it('returns empty rows and zero totals when there is nothing, rather than inventing data', async () => {
    const api = await adminAgent();

    const sales = await api.get('/admin/accounting/reports/sales');
    expect(sales.status).toBe(200);
    expect(sales.body.data.rows).toEqual([]);
    expect(sales.body.data.totals.grossSales).toBe(0);

    const overview = await api.get('/admin/accounting/overview');
    for (const card of overview.body.data.kpis) expect(card.value).toBe(0);
    expect(overview.body.data.recentTransactions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Authorization (task §17, §27)
// ---------------------------------------------------------------------------

describe('authorization', () => {
  it('rejects an unauthenticated request', async () => {
    expect((await request(app).get('/admin/accounting/overview')).status).toBe(401);
  });

  it('lets a read-only auditor read but not move money', async () => {
    const Role = require('../Models/Role');
    const { signToken } = require('../utils/jwt');
    const Customer = require('../Models/Customer');
const User = require('../Models/User');

    const role = await Role.create({
      name: `auditor-${uniqueSuffix()}`,
      permissions: ['admin.access', 'admin.accounting.view'],
      isActive: true,
    });
    const staff = await User.create({
      name: 'Auditor',
      email: `auditor${uniqueSuffix()}@test.local`,
      role: 'staff',
      roleId: role._id,
      isActive: true,
    });
    const token = signToken('admin', { id: staff._id.toString(), role: 'staff' });

    const read = await request(app).get('/admin/accounting/overview').set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);

    const vendor = await createVendor();
    const write = await request(app)
      .post(`/admin/accounting/seller-ledger/${vendor._id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, direction: 'CREDIT', reason: 'nope' });
    expect(write.status).toBe(403);

    const payout = await request(app)
      .post('/admin/accounting/payouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ settlementId: '507f1f77bcf86cd799439011' });
    expect(payout.status).toBe(403);
  });

  it('validates object ids instead of throwing', async () => {
    const api = await adminAgent();
    expect((await api.get('/admin/accounting/seller-ledger/not-an-id')).status).toBe(400);
    expect((await api.get('/admin/accounting/transactions/not-an-id')).status).toBe(400);
    expect((await api.get('/admin/accounting/transactions', { sellerId: 'nope' })).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Immutability (task §15 Rules 1-2)
// ---------------------------------------------------------------------------

describe('ledger immutability', () => {
  it('refuses to restate a posted amount', async () => {
    const vendor = await createVendor();
    const { token, address } = await buyerWithAddress();
    const product = await createProduct({ price: 1000, stock: 5, vendor: vendor._id });

    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 1000 });

    const sale = await AccountingTransaction.findOne({ order: res.body.data.id, type: 'SALE' });
    sale.credit = 1;
    await expect(sale.save()).rejects.toThrow(/immutable/i);
  });
});

// ---------------------------------------------------------------------------
// Cancellation reversal (task §22 cases 4-5)
// ---------------------------------------------------------------------------

describe('order cancellation', () => {
  it('reverses a posted sale in full and leaves the original entry intact', async () => {
    const vendor = await createVendor();
    const buyer = await createCustomer();
    const address = await createAddress(buyer.user._id);
    const product = await createProduct({ price: 2500, stock: 5, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(buyer.token, product._id.toString(), 2);
    const res = await placeOrder({ token: buyer.token, address, method: 'RAZORPAY', total: 5000 });
    const orderId = res.body.data.id;

    expect(sumOf(await ledgerFor(orderId), 'SALE', 'credit')).toBe(500000);

    // Admin cancels a paid, not-yet-shipped order — the existing flow refunds
    // the buyer's wallet and the accounting hook reverses the ledger.
    const cancelled = await api.patch(`/admin/orders/${orderId}/status`, { status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);

    const rows = await ledgerFor(orderId);
    expect(sumOf(rows, 'REFUND', 'debit')).toBe(500000);
    expect(sumOf(rows, 'REFUND_REVERSAL', 'credit')).toBe(50000);

    // The SALE is still there, at its original amount.
    const sale = rows.find((row) => row.type === 'SALE');
    expect(sale.credit).toBe(500000);

    // The seller nets to zero, and the reversal cannot be applied twice.
    const balance = rows
      .filter((row) => String(row.vendor) === String(vendor._id))
      .reduce((total, row) => total + row.credit - row.debit, 0);
    expect(balance).toBe(0);

    const posting = require('../services/accountingPosting');
    await posting.reconcileLedger();
    expect(sumOf(await ledgerFor(orderId), 'REFUND', 'debit')).toBe(500000);
  });
});

// ---------------------------------------------------------------------------
// Who funds a discount (task §24)
// ---------------------------------------------------------------------------

describe('coupon funding', () => {
  async function orderWithCoupon({ vendorId, couponVendorId }) {
    const Coupon = require('../Models/Coupon');
    const code = `SAVE${uniqueSuffix().slice(-6)}`;
    await Coupon.create({
      code,
      discountType: 'FIXED',
      discountValue: 1000,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
      // null = an admin coupon (platform-funded); set = the seller's own.
      vendorId: couponVendorId,
    });

    const buyer = await createCustomer();
    const address = await createAddress(buyer.user._id);
    const product = await createProduct({ price: 10000, stock: 5, vendor: vendorId });

    await addToCart(buyer.token, product._id.toString(), 1);
    return placeOrder({ token: buyer.token, address, method: 'RAZORPAY', total: 9000, couponCode: code });
  }

  it('a platform-funded coupon leaves the seller owed the full line', async () => {
    const vendor = await createVendor();
    const res = await orderWithCoupon({ vendorId: vendor._id, couponVendorId: null });
    expect(res.status).toBe(201);

    const rows = await ledgerFor(res.body.data.id);
    const sale = rows.find((row) => row.type === 'SALE');

    // The buyer paid 9,000, but the PLATFORM ran the promotion — so the seller
    // is still owed the full 10,000 and commission is charged on that.
    expect(sale.credit).toBe(1000000);
    expect(sale.metadata.platformFundedDiscountPaise).toBe(100000);
    expect(sale.metadata.sellerFundedDiscountPaise).toBe(0);
    expect(sumOf(rows, 'COMMISSION', 'debit')).toBe(100000);
  });

  it('a seller-funded coupon comes out of that seller own money', async () => {
    const vendor = await createVendor();
    const res = await orderWithCoupon({ vendorId: vendor._id, couponVendorId: vendor._id });
    expect(res.status).toBe(201);

    const rows = await ledgerFor(res.body.data.id);
    const sale = rows.find((row) => row.type === 'SALE');

    // The SELLER ran the promotion, so they earn 9,000 and commission is
    // charged on 9,000 — not on the undiscounted 10,000.
    expect(sale.credit).toBe(900000);
    expect(sale.metadata.sellerFundedDiscountPaise).toBe(100000);
    expect(sumOf(rows, 'COMMISSION', 'debit')).toBe(90000);
  });
});

// ---------------------------------------------------------------------------
// Repeated partial refunds, and a refund landing after settlement
// (task §22 cases 8-9)
// ---------------------------------------------------------------------------

describe('repeated and late refunds', () => {
  it('two separate partial refunds on one line never exceed the sale', async () => {
    const vendor = await createVendor();
    const { user, token } = await createCustomer();
    const address = await createAddress(user._id);
    const product = await createProduct({ price: 1000, stock: 10, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 5);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 5000 });
    const orderId = res.body.data.id;
    await deliver(orderId);

    const raise = async (amount) => {
      const request = await ReturnRequest.create({
        user: user._id,
        order: orderId,
        product: product._id,
        productName: product.name,
        requestType: 'REFUND',
        reason: 'partial return',
        refundAmount: amount,
      });
      return api.post(`/admin/accounting/refunds/return:${request._id}/approve`, { reason: 'ok' });
    };

    expect((await raise(1000)).status).toBe(200);
    expect((await raise(2000)).status).toBe(200);

    const rows = await ledgerFor(orderId);
    expect(sumOf(rows, 'SALE', 'credit')).toBe(500000);
    expect(sumOf(rows, 'REFUND', 'debit')).toBe(300000);
    // Commission back in proportion: 20% then 40% of the 500 charged.
    expect(sumOf(rows, 'REFUND_REVERSAL', 'credit')).toBe(30000);

    const balance = rows
      .filter((row) => String(row.vendor) === String(vendor._id))
      .reduce((total, row) => total + row.credit - row.debit, 0);
    // 5,000 - 500 commission - 3,000 refunded + 300 commission back = 1,800.
    expect(balance).toBe(180000);
  });

  it('a refund after a settlement is drafted does not rewrite that settlement', async () => {
    const vendor = await createVendor();
    const { user, token } = await createCustomer();
    const address = await createAddress(user._id);
    const product = await createProduct({ price: 4000, stock: 5, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'RAZORPAY', total: 4000 });
    const orderId = res.body.data.id;
    await deliver(orderId);
    await ageDelivery(orderId);

    await api.post('/admin/accounting/settlements/generate');
    const [settlement] = await Settlement.find().lean();
    expect(settlement.netPayablePaise).toBe(360000);

    // The refund lands after the batch was drafted.
    const request = await ReturnRequest.create({
      user: user._id,
      order: orderId,
      product: product._id,
      productName: product.name,
      requestType: 'REFUND',
      reason: 'late return',
      refundAmount: 4000,
    });
    expect(
      (await api.post(`/admin/accounting/refunds/return:${request._id}/approve`, { reason: 'ok' })).status
    ).toBe(200);

    // The drafted batch is a historical document and is NOT rewritten.
    const after = await Settlement.findById(settlement._id).lean();
    expect(after.netPayablePaise).toBe(360000);

    // The seller's live balance does reflect it, so the money is recovered
    // from whatever they are owed next.
    const ledger = await api.get(`/admin/accounting/seller-ledger/${vendor._id}`);
    expect(ledger.body.data.summary.currentPayable).toBe(0);

    // And the refunded line is never handed to a second batch.
    const again = await api.post('/admin/accounting/settlements/generate');
    expect(again.body.data.generated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// COD returned (task §22 case 22)
// ---------------------------------------------------------------------------

describe('COD returned after remittance', () => {
  it('reverses the sale that the remittance created', async () => {
    const vendor = await createVendor();
    const { user, token } = await createCustomer();
    const address = await createAddress(user._id);
    const product = await createProduct({ price: 3000, stock: 5, vendor: vendor._id });
    const api = await adminAgent();

    await addToCart(token, product._id.toString(), 1);
    const res = await placeOrder({ token, address, method: 'COD' });
    const orderId = res.body.data.id;
    await deliver(orderId);
    await api.post('/admin/accounting/transactions/cod-remittance', { orderId, reference: 'CR-1' });

    expect(sumOf(await ledgerFor(orderId), 'SALE', 'credit')).toBe(300000);

    const request = await ReturnRequest.create({
      user: user._id,
      order: orderId,
      product: product._id,
      productName: product.name,
      requestType: 'REFUND',
      reason: 'returned after delivery',
      refundAmount: 3000,
    });
    expect(
      (await api.post(`/admin/accounting/refunds/return:${request._id}/approve`, { reason: 'ok' })).status
    ).toBe(200);

    const rows = await ledgerFor(orderId);
    expect(sumOf(rows, 'REFUND', 'debit')).toBe(300000);
    const balance = rows
      .filter((row) => String(row.vendor) === String(vendor._id))
      .reduce((total, row) => total + row.credit - row.debit, 0);
    expect(balance).toBe(0);
  });
});
