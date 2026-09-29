// The seller earnings summary was sped up (coupons read in one query, orders
// priced a few at a time). It is money code, so this pins the new
// unsettledLines to the ORIGINAL implementation, copied verbatim below from
// the commit before the change, on a dataset that walks every branch:
// ledger-posted lines, estimated lines with frozen commission, legacy lines
// with no snapshot, seller-funded and platform coupons, a multi-seller order,
// and a line claimed by a batch.

jest.mock('../../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const Order = require('../../Models/Order');
const Coupon = require('../../Models/Coupon');
const AccountingTransaction = require('../../Models/AccountingTransaction');
const AccountingConfig = require('../../Models/AccountingConfig');
const { priceOrderCommissions } = require('../../services/accountingPosting');
const { unsettledLines } = require('../../Controllers/vendorEarningsController');
const { connectTestDb, disconnectTestDb, createVendor, createProduct, buyerWithAddress, addToCart, as } = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

// ---- reference: vendorEarningsController.unsettledLines before the change ----
async function unsettledLinesReference(vendorId, claimed) {
  const orders = await Order.find({ 'items.vendor': vendorId, 'items.status': 'DELIVERED' })
    .select('items couponCode discountAmount shippingFee subtotal total deliveredAt createdAt paymentMethod')
    .sort({ createdAt: -1 })
    .lean();
  if (orders.length === 0) return [];

  const ledger = await AccountingTransaction.aggregate([
    {
      $match: {
        vendor: vendorId,
        order: { $in: orders.map((order) => order._id) },
        type: { $in: ['SALE', 'COMMISSION', 'PAYMENT_GATEWAY_FEE', 'SHIPPING_CHARGE', 'REFUND', 'REFUND_REVERSAL'] },
      },
    },
    {
      $group: {
        _id: { order: '$order', product: '$product' },
        salePaise: { $sum: { $cond: [{ $eq: ['$type', 'SALE'] }, '$credit', 0] } },
        commissionPaise: { $sum: { $cond: [{ $eq: ['$type', 'COMMISSION'] }, '$debit', 0] } },
        feesPaise: { $sum: { $cond: [{ $eq: ['$type', 'PAYMENT_GATEWAY_FEE'] }, '$debit', 0] } },
        shippingPaise: { $sum: { $cond: [{ $eq: ['$type', 'SHIPPING_CHARGE'] }, '$credit', 0] } },
        refundPaise: { $sum: { $cond: [{ $eq: ['$type', 'REFUND'] }, '$debit', 0] } },
        commissionBackPaise: { $sum: { $cond: [{ $eq: ['$type', 'REFUND_REVERSAL'] }, '$credit', 0] } },
      },
    },
  ]);
  const posted = new Map(ledger.map((entry) => [`${entry._id.order}:${entry._id.product}`, entry]));

  const config = await AccountingConfig.resolve();
  const rows = [];

  for (const order of orders) {
    let estimate = null;

    for (const item of order.items) {
      if (String(item.vendor) !== String(vendorId) || item.status !== 'DELIVERED') continue;
      const key = `${order._id}:${item.product}`;
      if (claimed.has(key)) continue;

      const base = {
        order: order._id,
        product: item.product,
        name: item.name,
        quantity: item.quantity,
        deliveredAt: order.deliveredAt,
      };

      const entry = posted.get(key);
      if (entry && entry.salePaise > 0) {
        // Same arithmetic as settlementService.collectEligibleLines.
        const commissionPaise = entry.commissionPaise - entry.commissionBackPaise;
        const netPaise =
          entry.salePaise +
          entry.shippingPaise +
          entry.commissionBackPaise -
          entry.commissionPaise -
          entry.feesPaise -
          entry.refundPaise;
        rows.push({ ...base, grossPaise: entry.salePaise, commissionPaise, netPaise, estimated: false });
        continue;
      }

      // Priced once per order, however many of its lines are this seller's.
      if (!estimate) estimate = await priceOrderCommissions(order, { config });
      const line = estimate.sellerLines.find(
        (candidate) =>
          String(candidate.product) === String(item.product) && String(candidate.vendor) === String(vendorId)
      );
      if (!line) continue;
      rows.push({
        ...base,
        grossPaise: line.sellerGrossPaise,
        commissionPaise: line.commission.amountPaise,
        netPaise: line.sellerGrossPaise - line.commission.amountPaise,
        estimated: true,
      });
    }
  }

  return rows;
}
// ---- end reference ----

const ADDRESS = { fullName: 'x', phone: '9', line1: 'l', city: 'c', state: 's', pincode: '1' };

test('the faster unsettledLines returns exactly what the original did', async () => {
  const seller = await createVendor();
  const other = await createVendor();
  const p1 = await createProduct({ vendor: seller.vendor._id, price: 1200, stock: 50, gstRate: 5 });
  const p2 = await createProduct({ vendor: seller.vendor._id, price: 349.5, stock: 50, gstRate: 0 });
  const p3 = await createProduct({ vendor: other.vendor._id, price: 800, stock: 50, gstRate: 0 });

  const sellerCoupon = await Coupon.create({
    code: `EQS${Date.now()}`, discountType: 'FIXED', discountValue: 100, applicableTo: 'PRODUCTS',
    productIds: [p1._id], vendorId: seller.vendor._id, isActive: true,
    startDate: new Date(Date.now() - 1000), endDate: new Date(Date.now() + 86400000),
  });
  const platformCoupon = await Coupon.create({
    code: `EQP${Date.now()}`, discountType: 'PERCENTAGE', discountValue: 10, applicableTo: 'ALL', isActive: true,
    startDate: new Date(Date.now() - 1000), endDate: new Date(Date.now() + 86400000),
  });

  // Real checkouts, so lines carry frozen commission and prepaid ones post to the ledger.
  const place = async (method, lines, couponCode) => {
    const b = await buyerWithAddress({ walletBalance: 100000 });
    for (const [product, qty] of lines) await addToCart(b.token, product._id, qty);
    const res = await as(b.token).post('/user/orders', {
      addressId: String(b.address._id), paymentMethod: method, ...(couponCode ? { couponCode } : {}),
    });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };
  const ids = [
    await place('COD', [[p1, 1], [p2, 2]]),                          // estimated, frozen
    await place('COD', [[p1, 2]], sellerCoupon.code),                // estimated, seller-funded coupon
    await place('COD', [[p2, 1], [p3, 1]], platformCoupon.code),     // estimated, platform coupon, multi-seller
    await place('WALLET', [[p1, 1]]),                                // posted to the ledger
    await place('WALLET', [[p2, 3], [p3, 2]], platformCoupon.code),  // posted, multi-seller, coupon
  ];
  await Order.updateMany({ _id: { $in: ids } }, { $set: { 'items.$[].status': 'DELIVERED', status: 'DELIVERED' } });

  // A legacy order with no commission snapshot: priced from the rules.
  const legacy = await Order.create({
    user: (await buyerWithAddress()).user._id,
    items: [{ product: p2._id, name: p2.name, price: 349.5, quantity: 4, vendor: seller.vendor._id, status: 'DELIVERED' }],
    shippingAddress: ADDRESS, subtotal: 1398, total: 1398, paymentMethod: 'COD', status: 'DELIVERED',
    deliveredAt: new Date(),
  });
  expect(legacy.items[0].commission).toBeFalsy();
  expect(await AccountingTransaction.countDocuments({ vendor: seller.vendor._id })).toBeGreaterThan(0);

  const claimed = new Set([`${ids[1]}:${p1._id}`]); // a line owned by a live batch
  const expected = await unsettledLinesReference(seller.vendor._id, claimed);
  const actual = await unsettledLines(seller.vendor._id, claimed);

  expect(expected.length).toBeGreaterThanOrEqual(6);
  expect(expected.some((r) => r.estimated)).toBe(true);
  expect(expected.some((r) => !r.estimated)).toBe(true);
  expect(JSON.parse(JSON.stringify(actual))).toEqual(JSON.parse(JSON.stringify(expected)));
});
