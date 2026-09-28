// One multi-seller checkout walked through the buyer, seller and admin APIs,
// with the money reconciled at every step: quote, charge, ledger, invoice,
// seller rejection, delivery, return, settlement and cancellation.
jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn(async ({ amount }) => ({ id: `order_${Date.now()}`, amount, currency: 'INR' })) },
  payments: { fetch: jest.fn(), refund: jest.fn(async () => ({ id: `rfnd_${Date.now()}` })) },
}));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const Customer = require('../Models/Customer');
const PlatformSettings = require('../Models/PlatformSettings');
const AccountingConfig = require('../Models/AccountingConfig');
const AccountingTransaction = require('../Models/AccountingTransaction');
const Coupon = require('../Models/Coupon');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createVendor,
  createCategory,
  createProduct,
  createAddress,
} = require('./helpers');

const findings = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) findings.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return ok;
}
const r2 = (n) => Math.round(n * 100) / 100;

let savedPlatform;
let savedConfig;
beforeAll(async () => {
  await connectTestDb();
  // The in-memory DB is shared by every test file: put these back afterwards.
  const platform = await PlatformSettings.getSettings();
  const config = await AccountingConfig.resolve();
  savedPlatform = {
    defaultGstRate: platform.defaultGstRate,
    buyerPlatformFeeType: platform.buyerPlatformFeeType,
    buyerPlatformFeeValue: platform.buyerPlatformFeeValue,
  };
  savedConfig = {
    defaultCommissionPercent: config.defaultCommissionPercent,
    gatewayFeePercent: config.gatewayFeePercent,
    gatewayFeeBearer: config.gatewayFeeBearer,
    settlementHoldDays: config.settlementHoldDays,
  };
  await PlatformSettings.updateOne(
    { key: 'GLOBAL' },
    { $set: { defaultGstRate: 18, buyerPlatformFeeType: 'percentage', buyerPlatformFeeValue: 2 } }
  );
  await AccountingConfig.updateOne(
    { key: 'GLOBAL' },
    { $set: { defaultCommissionPercent: 10, gatewayFeePercent: 2, gatewayFeeBearer: 'PLATFORM', settlementHoldDays: 0 } }
  );
});
afterAll(async () => {
  await PlatformSettings.updateOne({ key: 'GLOBAL' }, { $set: savedPlatform });
  await AccountingConfig.updateOne({ key: 'GLOBAL' }, { $set: savedConfig });
  await disconnectTestDb();
});

const as = (token) => ({
  get: (p) => request(app).get(p).set('Authorization', `Bearer ${token}`),
  post: (p, b = {}) => request(app).post(p).set('Authorization', `Bearer ${token}`).send(b),
  patch: (p, b = {}) => request(app).patch(p).set('Authorization', `Bearer ${token}`).send(b),
});

async function ledger(orderId) {
  return AccountingTransaction.find({ order: orderId }).lean();
}
function sum(rows, filter, field) {
  return rows.filter(filter).reduce((s, r) => s + r[field], 0);
}
function sellerNetPaise(rows, vendorId) {
  const mine = rows.filter((r) => String(r.vendor) === String(vendorId));
  return sum(mine, () => true, 'credit') - sum(mine, () => true, 'debit');
}

async function payWithRazorpay(buyer, body) {
  const rzp = await buyer.post('/user/orders/razorpay-order', body);
  expect(rzp.status).toBe(200);
  const orderId = rzp.body.data.razorpayOrderId;
  const paymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
  razorpay.payments.fetch.mockResolvedValueOnce({
    id: paymentId,
    order_id: orderId,
    status: 'captured',
    amount: Math.round(rzp.body.data.amount * 100),
  });
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return buyer.post('/user/orders', {
    ...body,
    paymentMethod: 'RAZORPAY',
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  });
}

describe('money audit — multi-seller prepaid order', () => {
  const ctx = {};

  test('setup: two sellers + own stock, admin coupon', async () => {
    const { token: adminToken } = await createAdmin();
    ctx.admin = as(adminToken);
    const category = await createCategory();
    ({ vendor: ctx.vendorA, token: ctx.tokA } = await createVendor({ verificationStatus: 'APPROVED' }));
    ({ vendor: ctx.vendorB, token: ctx.tokB } = await createVendor({ verificationStatus: 'APPROVED' }));
    ctx.sellerA = as(ctx.tokA);
    ctx.sellerB = as(ctx.tokB);

    // A: ₹1000 + 18% GST on top (exclusive) → ₹1180 each.
    ctx.pA = await createProduct({ category, vendor: ctx.vendorA._id, price: 1000, gstRate: 18, gstInclusive: false, approvalStatus: 'APPROVED', isReturnable: true });
    // B: ₹500 GST 12% included.
    ctx.pB = await createProduct({ category, vendor: ctx.vendorB._id, price: 500, gstRate: 12, gstInclusive: true, approvalStatus: 'APPROVED' });
    // Krozenda own stock: ₹300, default GST (18%) inclusive.
    ctx.pK = await createProduct({ category, price: 300, approvalStatus: 'APPROVED' });

    const coupon = await ctx.admin.post('/admin/marketing/coupons', {
      code: `AUDIT${Date.now() % 100000}`,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startDate: new Date(Date.now() - 86400000).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      isActive: true,
    });
    expect(coupon.status).toBe(201);
    ctx.couponCode = coupon.body.data.code;

    const { user, token } = await createCustomer();
    ctx.buyerUser = user;
    ctx.buyer = as(token);
    ctx.buyerToken = token;
    ctx.address = await createAddress(user._id);
    for (const [p, q] of [[ctx.pA, 2], [ctx.pB, 1], [ctx.pK, 1]]) {
      const res = await ctx.buyer.post('/user/cart/items', { productId: String(p._id), quantity: q });
      expect(res.status).toBeLessThan(300);
    }
  });

  test('buyer: quote lines add up and match the charged amount', async () => {
    const body = { addressId: String(ctx.address._id), couponCode: ctx.couponCode, paymentMethod: 'RAZORPAY' };
    const quote = await ctx.buyer.post('/user/orders/shipping-quote', body);
    expect(quote.status).toBe(200);
    const q = quote.body.data;
    ctx.quote = q;

    // goods: 2×1180 + 500 + 300 = 3160; coupon 10% = 316; fee 2% of 2844 = 56.88
    check('quote subtotal', q.subtotal, 3160);
    check('quote discount', q.discountAmount, 316);
    check('quote platformFee', q.platformFee, 56.88);
    check('quote total', q.total, 2900.88);
    const tb = q.tax || {};
    check('listSubtotal+gstAdded-coupon+ship+fee = total',
      r2(tb.listSubtotal + tb.gstAdded - q.discountAmount + (q.shippingFee ?? q.shipping ?? 0) + q.platformFee), q.total);

    const placed = await payWithRazorpay(ctx.buyer, body);
    expect(placed.status).toBe(201);
    ctx.orderId = placed.body.data.id;
    const order = await Order.findById(ctx.orderId).lean();
    ctx.order = order;
    check('order total', order.total, 2900.88);
    check('order platformFee', order.platformFee, 56.88);
    check('line discounts sum = order discount', r2(order.items.reduce((s, i) => s + i.discountAmount, 0)), order.discountAmount);
    check('commission snapshot on seller lines', order.items.filter((i) => i.vendor).every((i) => i.commission && i.commission.amountPaise > 0), true);
    check('no commission snapshot on own-stock line', order.items.filter((i) => !i.vendor).every((i) => !i.commission || !i.commission.amountPaise), true);
  });

  test('ledger right after the sale', async () => {
    const rows = await ledger(ctx.orderId);
    // Platform coupon: seller credited the full line.
    check('seller A SALE', sum(rows, (r) => r.type === 'SALE' && String(r.vendor) === String(ctx.vendorA._id), 'credit'), 236000);
    check('seller A COMMISSION', sum(rows, (r) => r.type === 'COMMISSION' && String(r.vendor) === String(ctx.vendorA._id), 'debit'), 23600);
    check('seller B SALE', sum(rows, (r) => r.type === 'SALE' && String(r.vendor) === String(ctx.vendorB._id), 'credit'), 50000);
    check('PLATFORM_FEE row', sum(rows, (r) => r.type === 'PLATFORM_FEE', 'credit'), 5688);
    check('gateway fee 2% of total', sum(rows, (r) => r.type === 'PAYMENT_GATEWAY_FEE', 'debit'), Math.round(290088 * 0.02));
  });

  test('buyer invoice: taxable value reflects the coupon', async () => {
    const inv = await ctx.buyer.get(`/user/orders/${ctx.orderId}/invoice`);
    expect(inv.status).toBe(200);
    const invoices = inv.body.data.invoices || inv.body.data;
    const totalOfInvoices = (Array.isArray(invoices) ? invoices : []).reduce((s, i) => s + (i.totals?.total ?? i.total ?? 0), 0);
    check('sum of supplier invoices = amount charged (incl. platform fee), paise', totalOfInvoices, 290088);
  });

  test('seller B rejects its line → buyer refunded its share', async () => {
    const walletBefore = (await Customer.findById(ctx.buyerUser._id)).walletBalance || 0;
    const res = await ctx.sellerB.patch(`/vendor/orders/${ctx.orderId}/items/${ctx.pB._id}/status`, { status: 'CANCELLED', reason: 'Out of stock' });
    expect(res.status).toBe(200);
    const walletAfter = (await Customer.findById(ctx.buyerUser._id)).walletBalance || 0;
    const lineB = ctx.order.items.find((i) => String(i.product) === String(ctx.pB._id));
    check('B refund = line paid (500 - coupon share)', r2(walletAfter - walletBefore), r2(500 - lineB.discountAmount));
    // Platform fee was 2% on this line's goods too.
    const rows = await ledger(ctx.orderId);
    check('seller B net after reject = 0', sellerNetPaise(rows, ctx.vendorB._id), 0);
  });

  test('seller A ships + delivers; admin delivers own stock', async () => {
    let r = await ctx.sellerA.patch(`/vendor/orders/${ctx.orderId}/items/${ctx.pA._id}/status`, { status: 'PROCESSING' });
    expect(r.status).toBe(200);
    r = await ctx.sellerA.patch(`/vendor/orders/${ctx.orderId}/items/${ctx.pA._id}/status`, { status: 'SHIPPED', courierName: 'X', trackingNumber: 'T1' });
    expect(r.status).toBe(200);
    r = await ctx.sellerA.patch(`/vendor/orders/${ctx.orderId}/items/${ctx.pA._id}/status`, { status: 'DELIVERED' });
    if (r.status !== 200) findings.push(`seller cannot mark DELIVERED: ${r.status} ${r.body.message}`);
    for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
      const a = await ctx.admin.patch(`/admin/orders/${ctx.orderId}/status`, { status });
      if (a.status !== 200) findings.push(`admin order → ${status}: ${a.status} ${a.body.message}`);
    }
    const order = await Order.findById(ctx.orderId).lean();
    check('B line stays CANCELLED after admin DELIVERED', order.items.find((i) => String(i.product) === String(ctx.pB._id)).status, 'CANCELLED');
    check('order deliveredAt set', Boolean(order.deliveredAt), true);
    check('own-stock line DELIVERED with the order', order.items.find((i) => String(i.product) === String(ctx.pK._id)).status, 'DELIVERED');
  });

  test('seller A earnings match ledger before return', async () => {
    const s = await ctx.sellerA.get('/vendor/earnings/summary');
    expect(s.status).toBe(200);
    check('seller panel net earnings = ledger', s.body.data.netEarnings, 212400);
    const rows = await ledger(ctx.orderId);
    ctx.aNetBeforeReturn = sellerNetPaise(rows, ctx.vendorA._id);
    check('A net before return = 2360 - 236', ctx.aNetBeforeReturn, 212400);
  });

  test('buyer returns seller A line → refund to Razorpay, ledger claws back', async () => {
    const raised = await request(app)
      .post('/user/returns')
      .set('Authorization', `Bearer ${(await createCustomer()).token}`) // wrong buyer first
      .field('orderId', ctx.orderId).field('productId', String(ctx.pA._id)).field('requestType', 'REFUND').field('reason', 'Damaged product');
    check('another buyer cannot return my item', raised.status >= 400, true);

    const ok = await request(app)
      .post('/user/returns')
      .set('Authorization', `Bearer ${ctx.buyerToken}`)
      .field('orderId', ctx.orderId).field('productId', String(ctx.pA._id)).field('requestType', 'REFUND').field('reason', 'Damaged product');
    expect(ok.status).toBe(201);
    const id = ok.body.data.id;
    const lineA = ctx.order.items.find((i) => String(i.product) === String(ctx.pA._id));
    check('return refundAmount = line paid', ok.body.data.refundAmount, r2(2360 - lineA.discountAmount));

    expect((await ctx.admin.post(`/admin/returns/${id}/decide`, { decision: 'APPROVED' })).status).toBe(200);
    expect((await ctx.admin.post(`/admin/returns/${id}/received`)).status).toBe(200);
    const done = await ctx.admin.post(`/admin/returns/${id}/complete`, { restock: true });
    expect(done.status).toBe(200);

    const refundCall = razorpay.payments.refund.mock.calls.at(-1);
    check('Razorpay refund amount (paise)', refundCall && refundCall[1].amount, Math.round((2360 - lineA.discountAmount) * 100));

    const rows = await ledger(ctx.orderId);
    const aNet = sellerNetPaise(rows, ctx.vendorA._id);
    check('seller A net after full return of their only line = 0', aNet, 0);
    const order = await Order.findById(ctx.orderId).lean();
    check('order.refundedAmount = B refund + A refund', order.refundedAmount,
      r2(500 - ctx.order.items.find((i) => String(i.product) === String(ctx.pB._id)).discountAmount + 2360 - lineA.discountAmount));
  });

  test('settlement: nothing payable to A for a fully returned line', async () => {
    const gen = await ctx.admin.post('/admin/accounting/settlements/generate', {});
    expect(gen.status).toBe(200);
    check('no settlement batch for seller A', gen.body.data.items.filter((b) => b.sellerId === String(ctx.vendorA._id)).length, 0);
    const bal = await ctx.admin.get(`/admin/accounting/seller-ledger/${ctx.vendorA._id}`);
    expect(bal.status).toBe(200);
  });

  test('platform books: fee + shipping reversed on full cancellation', async () => {
    // Fresh wallet-paid order with only seller B, cancelled by buyer.
    await ctx.buyer.post('/user/cart/items', { productId: String(ctx.pB._id), quantity: 1 });
    const cust = await Customer.findById(ctx.buyerUser._id);
    await Customer.updateOne({ _id: cust._id }, { $inc: { walletBalance: 1000 } });
    const placed = await ctx.buyer.post('/user/orders', { addressId: String(ctx.address._id), paymentMethod: 'WALLET' });
    expect(placed.status).toBe(201);
    const oid = placed.body.data.id;
    const before = (await Customer.findById(cust._id)).walletBalance;
    const c = await ctx.buyer.patch(`/user/orders/${oid}/cancel`);
    expect(c.status).toBe(200);
    const after = (await Customer.findById(cust._id)).walletBalance;
    const o = await Order.findById(oid).lean();
    check('cancel refunds full total incl. platform fee', r2(after - before), o.total);
    const rows = await ledger(oid);
    const platformNet = sum(rows, (r) => !r.vendor && r.type === 'PLATFORM_FEE', 'credit') - sum(rows, (r) => !r.vendor && r.type === 'REFUND', 'debit');
    check('platform fee revenue after full cancellation = 0', platformNet, 0);
  });

  test('no findings', () => {
    expect(findings).toEqual([]);
  });
});
