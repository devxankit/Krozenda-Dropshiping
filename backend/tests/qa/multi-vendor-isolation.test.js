// QA audit — multi-vendor checkout and seller isolation.
//
// One buyer, one cart, three sellers. The platform models "sub-orders" as
// the seller-owned lines of one Order (items[].vendor), not as separate
// documents, so isolation is enforced by filtering lines per seller. These
// tests check that filter from every side a seller can reach.

jest.mock('../../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const Order = require('../../Models/Order');
const Product = require('../../Models/Product');
const Coupon = require('../../Models/Coupon');
const { collectEligibleLines } = require('../../services/settlementService');
const { toPaise } = require('../../utils/money');
const {
  connectTestDb,
  disconnectTestDb,
  createVendor,
  createProduct,
  createCategory,
  buyerWithAddress,
  addToCart,
  placeCod,
  as,
  knownBug,
} = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const ctx = {};

beforeAll(async () => {
  ctx.category = await createCategory();
  ctx.sellers = [];
  for (const [i, price] of [[0, 1000], [1, 250.5], [2, 99.99]].map((x) => x)) {
    const seller = await createVendor({ verificationStatus: 'APPROVED', name: `Seller ${'ABC'[i]}` });
    const product = await createProduct({ vendor: seller.vendor._id, price, stock: 20, category: ctx.category._id, gstRate: 0 });
    ctx.sellers.push({ ...seller, product });
  }
  ctx.buyer = await buyerWithAddress();

  await addToCart(ctx.buyer.token, ctx.sellers[0].product._id, 1);
  await addToCart(ctx.buyer.token, ctx.sellers[1].product._id, 2);
  await addToCart(ctx.buyer.token, ctx.sellers[2].product._id, 3);
  const res = await placeCod(ctx.buyer.token, ctx.buyer.address._id);
  expect(res.status).toBe(201);
  ctx.orderId = res.body.data.id || res.body.data._id;
  ctx.order = await Order.findById(ctx.orderId);
});

describe('one marketplace order, one line-group per seller', () => {
  test('the buyer sees exactly one order holding all three sellers’ lines', async () => {
    const list = await as(ctx.buyer.token).get('/user/orders');
    expect(list.body.data.items).toHaveLength(1);
    expect(ctx.order.items).toHaveLength(3);
    const owners = ctx.order.items.map((i) => String(i.vendor)).sort();
    expect(owners).toEqual(ctx.sellers.map((s) => String(s.vendor._id)).sort());
  });

  test('totals reconcile to the paisa: Σ(price×qty) − discount + shipping + platform fee = total', () => {
    const o = ctx.order;
    const linesPaise = o.items.reduce((sum, i) => sum + toPaise(i.price) * i.quantity, 0);
    expect(toPaise(o.subtotal)).toBe(linesPaise);
    expect(linesPaise).toBe(100000 + 2 * 25050 + 3 * 9999);
    expect(toPaise(o.total)).toBe(linesPaise - toPaise(o.discountAmount) + toPaise(o.shippingFee) + toPaise(o.platformFee));
  });

  test('every seller line carries its own frozen commission snapshot', () => {
    for (const item of ctx.order.items) {
      expect(item.commission).toBeTruthy();
      expect(item.commission.amountPaise).toBeGreaterThanOrEqual(0);
      // never more than the line itself
      expect(item.commission.amountPaise).toBeLessThanOrEqual(toPaise(item.price) * item.quantity);
    }
  });

  test('stock decremented per seller, exactly by the quantity bought', async () => {
    const stocks = await Promise.all(ctx.sellers.map((s) => Product.findById(s.product._id).then((p) => p.stock)));
    expect(stocks).toEqual([19, 18, 17]);
  });
});

describe('seller A never sees or touches seller B', () => {
  test('each seller’s view of the order contains only their own line and value', async () => {
    for (const [i, seller] of ctx.sellers.entries()) {
      const res = await as(seller.token).get(`/vendor/orders/${ctx.orderId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].productId).toBe(String(seller.product._id));
      const expected = [100000, 50100, 29997][i];
      expect(res.body.data.itemsValue).toBe(expected);
      // no other seller's product name leaks anywhere in the payload
      const others = ctx.sellers.filter((s) => s !== seller).map((s) => s.product.name);
      for (const name of others) expect(JSON.stringify(res.body)).not.toContain(name);
    }
  });

  test('seller A cannot move seller B’s line (404, B’s line untouched)', async () => {
    const [a, b] = ctx.sellers;
    const res = await as(a.token).patch(`/vendor/orders/${ctx.orderId}/items/${b.product._id}/status`, { status: 'PROCESSING' });
    expect(res.status).toBe(404);
    const fresh = await Order.findById(ctx.orderId);
    expect(fresh.items.find((i) => String(i.vendor) === String(b.vendor._id)).status).toBe('PENDING');
  });

  test('seller A cannot cancel seller B’s line', async () => {
    const [a, , c] = ctx.sellers;
    const res = await as(a.token).patch(`/vendor/orders/${ctx.orderId}/items/${c.product._id}/status`, { status: 'CANCELLED', reason: 'x' });
    expect(res.status).toBe(404);
  });

  test('seller A cannot read, edit or delete seller B’s product', async () => {
    const [a, b] = ctx.sellers;
    expect((await as(a.token).get(`/vendor/products/${b.product._id}`)).status).toBe(404);
    expect((await as(a.token).put(`/vendor/products/${b.product._id}`, { price: 1 })).status).toBe(404);
    expect((await as(a.token).delete(`/vendor/products/${b.product._id}`)).status).toBe(404);
    expect((await Product.findById(b.product._id)).price).toBe(250.5);
  });

  test('seller A cannot adjust seller B’s stock', async () => {
    const [a, b] = ctx.sellers;
    const res = await as(a.token).patch(`/vendor/inventory/${b.product._id}`, { stock: 0 });
    expect([403, 404]).toContain(res.status);
    expect((await Product.findById(b.product._id)).stock).toBe(18);
  });

  test('seller A cannot create a coupon on seller B’s product', async () => {
    const [a, b] = ctx.sellers;
    const res = await as(a.token).post('/vendor/coupons', {
      code: `QAXV${Date.now()}`,
      discountType: 'PERCENTAGE',
      discountValue: 50,
      productIds: [String(b.product._id)],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(res.status).toBe(400);
  });

  test('seller order list is scoped to the seller', async () => {
    const outsider = await createVendor({ verificationStatus: 'APPROVED' });
    const res = await as(outsider.token).get('/vendor/orders');
    expect(res.body.data.items).toHaveLength(0);
    expect((await as(outsider.token).get(`/vendor/orders/${ctx.orderId}`)).status).toBe(404);
  });
});

describe('seller-declared delivery', () => {
  test(
    'QA-003 (regression): a seller marking their own prepaid line SHIPPED→DELIVERED with a made-up AWB does not make it settleable',
    async () => {
      const seller = await createVendor({ verificationStatus: 'APPROVED' });
      const product = await createProduct({ vendor: seller.vendor._id, price: 5000, stock: 5, gstRate: 0 });
      const buyer = await buyerWithAddress({ walletBalance: 100000 });
      await addToCart(buyer.token, product._id, 1);
      const placed = await as(buyer.token).post('/user/orders', { addressId: String(buyer.address._id), paymentMethod: 'WALLET' });
      expect(placed.status).toBe(201);
      const orderId = placed.body.data.id;
      const path = `/vendor/orders/${orderId}/items/${product._id}/status`;

      expect((await as(seller.token).patch(path, { status: 'PROCESSING' })).status).toBe(200);
      expect((await as(seller.token).patch(path, { status: 'SHIPPED', trackingNumber: 'NOT-A-REAL-AWB' })).status).toBe(200);
      expect((await as(seller.token).patch(path, { status: 'DELIVERED' })).status).toBe(200);

      // Hold window elapses.
      await Order.updateOne({ _id: orderId }, { $set: { deliveredAt: new Date(Date.now() - 30 * 86400000) } });
      const eligible = await collectEligibleLines({ vendorId: seller.vendor._id });
      const lines = eligible.get(String(seller.vendor._id)) || [];
      // Correct behaviour: no carrier-confirmed delivery → nothing to pay out.
      expect(lines).toHaveLength(0);
    }
  );
});

describe('delivery confirmation releases the payout', () => {
  async function sellerDeliveredLine() {
    const seller = await createVendor();
    const product = await createProduct({ vendor: seller.vendor._id, price: 5000, stock: 5, gstRate: 0 });
    const buyer = await buyerWithAddress({ walletBalance: 100000 });
    await addToCart(buyer.token, product._id, 1);
    const placed = await as(buyer.token).post('/user/orders', { addressId: String(buyer.address._id), paymentMethod: 'WALLET' });
    const orderId = placed.body.data.id;
    const path = `/vendor/orders/${orderId}/items/${product._id}/status`;
    await as(seller.token).patch(path, { status: 'PROCESSING' });
    await as(seller.token).patch(path, { status: 'SHIPPED', trackingNumber: 'AWB-1' });
    await as(seller.token).patch(path, { status: 'DELIVERED' });
    await Order.updateOne({ _id: orderId }, { $set: { deliveredAt: new Date(Date.now() - 30 * 86400000) } });
    return { seller, product, orderId };
  }
  const eligibleFor = async (seller) =>
    (await collectEligibleLines({ vendorId: seller.vendor._id })).get(String(seller.vendor._id)) || [];
  const adminClient = async () => as((await require('./qaHelpers').createAdmin()).token);

  test('the buyer and seller still see it delivered', async () => {
    const { seller, orderId } = await sellerDeliveredLine();
    expect((await Order.findById(orderId)).status).toBe('DELIVERED');
    expect((await as(seller.token).get(`/vendor/orders/${orderId}`)).body.data.status).toBe('DELIVERED');
  });

  test('an admin confirming it from the sub-orders screen makes it settleable (once)', async () => {
    const { seller, product, orderId } = await sellerDeliveredLine();
    const admin = await adminClient();
    const unconfirmed = await admin.get('/admin/sub-orders?tab=unconfirmed&rowsPerPage=100');
    expect(unconfirmed.body.data.items.map((r) => r.orderId)).toContain(orderId);
    const id = `${orderId}:${product._id}:`;
    const ok = await admin.post(`/admin/fulfilment/sub-orders/${id}/confirm-delivery`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.deliveryConfirmedBy).toBe('ADMIN');
    expect((await admin.post(`/admin/fulfilment/sub-orders/${id}/confirm-delivery`)).status).toBe(409);
    expect(await eligibleFor(seller)).toHaveLength(1);
  });

  test('the carrier confirming it makes it settleable', async () => {
    const { seller, product, orderId } = await sellerDeliveredLine();
    const { syncOrderFromShipment } = require('../../services/shipping/shipmentService');
    await syncOrderFromShipment({
      order: orderId,
      shipmentType: 'FORWARD',
      internalStatus: 'DELIVERED',
      items: [{ product: product._id }],
    });
    expect((await Order.findById(orderId)).items[0].deliveryConfirmedBy).toBe('CARRIER');
    expect(await eligibleFor(seller)).toHaveLength(1);
  });

  test('an admin marking the whole order delivered confirms its lines', async () => {
    const { seller, orderId } = await sellerDeliveredLine();
    await Order.updateOne({ _id: orderId }, { $set: { status: 'SHIPPED' } });
    const admin = await adminClient();
    const res = await admin.patch(`/admin/orders/${orderId}/status`, { status: 'DELIVERED' });
    expect(res.status).toBe(200);
    await Order.updateOne({ _id: orderId }, { $set: { deliveredAt: new Date(Date.now() - 30 * 86400000) } });
    expect((await Order.findById(orderId)).items[0].deliveryConfirmedBy).toBe('ADMIN');
    expect(await eligibleFor(seller)).toHaveLength(1);
  });

  test('lines delivered before this existed (no confirmation recorded) stay settleable', async () => {
    const { seller, orderId } = await sellerDeliveredLine();
    await Order.updateOne({ _id: orderId }, { $set: { 'items.0.deliveryConfirmedBy': null } });
    expect(await eligibleFor(seller)).toHaveLength(1);
  });
});

describe('QA-015: material edits to an approved product go back for review', () => {
  async function approvedProduct() {
    const seller = await createVendor();
    const product = await createProduct({
      vendor: seller.vendor._id,
      images: ['/uploads/products/a.webp', '/uploads/products/b.webp'],
      approvalStatus: 'APPROVED',
    });
    return { seller, product };
  }
  const visible = async (id) => (await as(null).get(`/catalog/products/${id}`)).status;

  test.each([
    ['name', () => ({ name: 'Something else entirely' })],
    ['category', (cat) => ({ category: String(cat._id) })],
    ['photos', () => ({ removeImages: JSON.stringify(['/uploads/products/a.webp']) })],
  ])('changing the %s hides it until approved', async (_label, patch) => {
    const { seller, product } = await approvedProduct();
    const other = await createCategory();
    const res = await as(seller.token).put(`/vendor/products/${product._id}`, patch(other));
    expect(res.status).toBe(200);
    const fresh = await Product.findById(product._id);
    expect(fresh.approvalStatus).toBe('PENDING');
    expect(fresh.isActive).toBe(false);
    expect(await visible(product._id)).toBe(404);
    expect(res.body.message).toMatch(/sent for admin approval/);
  });

  test('price and stock edits stay live without review', async () => {
    const { seller, product } = await approvedProduct();
    await as(seller.token).put(`/vendor/products/${product._id}`, { price: 777, stock: 3 });
    const fresh = await Product.findById(product._id);
    expect(fresh.approvalStatus).toBe('APPROVED');
    expect(fresh.price).toBe(777);
    expect(await visible(product._id)).toBe(200);
  });

  test('re-saving the same name is not a change', async () => {
    const { seller, product } = await approvedProduct();
    await as(seller.token).put(`/vendor/products/${product._id}`, { name: product.name });
    expect((await Product.findById(product._id)).approvalStatus).toBe('APPROVED');
  });

  test('with auto-approval on, edits stay approved', async () => {
    const CatalogSettings = require('../../Models/CatalogSettings');
    const settings = await CatalogSettings.getSettings();
    const prev = settings.autoApprovalEnabled;
    settings.autoApprovalEnabled = true;
    await settings.save();
    try {
      const { seller, product } = await approvedProduct();
      await as(seller.token).put(`/vendor/products/${product._id}`, { name: 'Renamed' });
      expect((await Product.findById(product._id)).approvalStatus).toBe('APPROVED');
    } finally {
      settings.autoApprovalEnabled = prev;
      await settings.save();
    }
  });

  test('admin re-approval puts it back on sale', async () => {
    const { seller, product } = await approvedProduct();
    await as(seller.token).put(`/vendor/products/${product._id}`, { name: 'Renamed again' });
    const admin = as((await require('./qaHelpers').createAdmin()).token);
    const res = await admin.patch(`/admin/catalog/products/${product._id}/approval`, { decision: 'APPROVED' });
    expect(res.status).toBe(200);
    expect(await visible(product._id)).toBe(200);
  });
});

describe('suspended / unapproved seller catalogue', () => {
  test('QA-004a (regression): a suspended seller’s products must disappear from the storefront', async () => {
    const seller = await createVendor({ verificationStatus: 'APPROVED' });
    const product = await createProduct({ vendor: seller.vendor._id, name: `QA Suspended ${Date.now()}` });
    expect((await as(null).get(`/catalog/products/${product._id}`)).status).toBe(200);

    seller.vendor.isActive = false;
    await seller.vendor.save();

    const res = await as(null).get(`/catalog/products/${product._id}`);
    expect(res.status).toBe(404);
  });

  test('QA-004b (regression): a suspended seller’s products must not be purchasable', async () => {
    const seller = await createVendor({ verificationStatus: 'APPROVED' });
    const product = await createProduct({ vendor: seller.vendor._id, stock: 5 });
    const buyer = await buyerWithAddress();
    await addToCart(buyer.token, product._id, 1);
    seller.vendor.isActive = false;
    await seller.vendor.save();
    const res = await placeCod(buyer.token, buyer.address._id);
    expect(res.status).not.toBe(201);
  });

  test('QA-004c (regression): a KYC-pending seller’s product must not go live even with auto-approval on', async () => {
    const CatalogSettings = require('../../Models/CatalogSettings');
    const settings = await CatalogSettings.getSettings();
    const prev = settings.autoApprovalEnabled;
    settings.autoApprovalEnabled = true;
    await settings.save();
    try {
      const pending = await createVendor({ verificationStatus: 'PENDING', isActive: false });
      const res = await as(pending.token).post('/vendor/products', {
        name: 'Pending seller item',
        sku: `QA-PEND-${Date.now()}`,
        category: String(ctx.category._id),
        price: 100,
        stock: 5,
        weight: 0.5,
        images: JSON.stringify(['/uploads/products/placeholder.webp']),
      });
      const visible = res.body.data?.id ? await as(null).get(`/catalog/products/${res.body.data.id}`) : { status: 404 };
      expect(visible.status).toBe(404);
    } finally {
      settings.autoApprovalEnabled = prev;
      await settings.save();
    }
  });
});

describe('seller state round-trip', () => {
  test('re-activating a suspended seller restores exactly what was live (not their drafts)', async () => {
    const seller = await createVendor({ verificationStatus: 'APPROVED' });
    const live = await createProduct({ vendor: seller.vendor._id });
    const draft = await createProduct({ vendor: seller.vendor._id, isActive: false });
    seller.vendor.isActive = false;
    await seller.vendor.save();
    expect((await as(null).get(`/catalog/products/${live._id}`)).status).toBe(404);
    seller.vendor.isActive = true;
    await seller.vendor.save();
    expect((await as(null).get(`/catalog/products/${live._id}`)).status).toBe(200);
    expect((await as(null).get(`/catalog/products/${draft._id}`)).status).toBe(404);
  });

  test('approving a pending seller puts their approved products on sale', async () => {
    const seller = await createVendor({ verificationStatus: 'PENDING', isActive: false });
    const product = await createProduct({ vendor: seller.vendor._id });
    expect((await as(null).get(`/catalog/products/${product._id}`)).status).toBe(404);
    seller.vendor.verificationStatus = 'APPROVED';
    seller.vendor.isActive = true;
    await seller.vendor.save();
    expect((await as(null).get(`/catalog/products/${product._id}`)).status).toBe(200);
  });

  test('a suspended seller’s product already in a cart cannot be checked out, and says why', async () => {
    const seller = await createVendor({ verificationStatus: 'APPROVED' });
    const product = await createProduct({ vendor: seller.vendor._id, stock: 5 });
    const buyer = await buyerWithAddress();
    await addToCart(buyer.token, product._id, 1);
    seller.vendor.isActive = false;
    await seller.vendor.save();
    const res = await placeCod(buyer.token, buyer.address._id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CART_ITEM_UNAVAILABLE');
    expect((await addToCart(buyer.token, product._id, 1)).status).toBe(404);
  });
});

describe('seller self-promotion flags', () => {
  test('QA-005 (regression): a seller cannot put their own product into Trending / Flash Sale', async () => {
    const seller = await createVendor({ verificationStatus: 'APPROVED' });
    const product = await createProduct({ vendor: seller.vendor._id, approvalStatus: 'APPROVED', images: ['/uploads/products/p.webp'] });
    // (an image is required or the update is refused for an unrelated reason)
    await as(seller.token).put(`/vendor/products/${product._id}`, { isTrending: 'true', isFlashsale: 'true' });
    const fresh = await Product.findById(product._id);
    expect(fresh.isTrending).toBe(false);
    expect(fresh.isFlashsale).toBe(false);
  });
});

describe('coupon scoping', () => {
  test('a seller-funded coupon only discounts that seller’s line', async () => {
    const [a, b] = ctx.sellers;
    const code = `QASELL${Date.now()}`;
    await Coupon.create({
      code,
      discountType: 'FIXED',
      discountValue: 500,
      applicableTo: 'PRODUCTS',
      productIds: [b.product._id],
      vendorId: b.vendor._id,
      startDate: new Date(Date.now() - 1000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });
    const buyer = await buyerWithAddress();
    await addToCart(buyer.token, a.product._id, 1);
    await addToCart(buyer.token, b.product._id, 1);
    const res = await placeCod(buyer.token, buyer.address._id, { couponCode: code });
    expect(res.status).toBe(201);
    const order = await Order.findById(res.body.data.id);
    const lineA = order.items.find((i) => String(i.vendor) === String(a.vendor._id));
    const lineB = order.items.find((i) => String(i.vendor) === String(b.vendor._id));
    expect(lineA.discountAmount).toBe(0);
    // FIXED 500 capped at the eligible line's own value (250.50)
    expect(lineB.discountAmount).toBe(250.5);
    expect(order.discountAmount).toBe(250.5);
  });
});
