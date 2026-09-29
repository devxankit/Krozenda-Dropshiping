// QA-014 (perf) regression: admin and seller order lists page in the
// database instead of loading every order and slicing in memory.
//
// The seller list's tab is DERIVED from the seller's own lines. The database
// now computes it (sellerStatusExpr) while each row is still serialized by
// serializeVendorOrder — these tests pin the two to the same answer.

const Order = require('../../Models/Order');
const { serializeVendorOrder } = require('../../Controllers/vendorOrderController');
const {
  connectTestDb,
  disconnectTestDb,
  createAdmin,
  createVendor,
  createProduct,
  createCustomer,
  as,
} = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const ADDRESS = { fullName: 'x', phone: '9', line1: 'l', city: 'c', state: 's', pincode: '1' };

// Every mix of line states that the derived status distinguishes.
const LINE_MIXES = [
  { mine: ['PENDING'] },
  { mine: ['PROCESSING', 'PENDING'] },
  { mine: ['SHIPPED', 'PROCESSING'] },
  { mine: ['DELIVERED'] },
  { mine: ['DELIVERED', 'DELIVERED'] },
  { mine: ['CANCELLED'] },
  { mine: ['CANCELLED', 'DELIVERED'] },
  { mine: ['CANCELLED', 'PENDING'] },
  { mine: ['DELIVERED', 'SHIPPED'] },
  { mine: ['PENDING'], orderStatus: 'CANCELLED' },
  { mine: ['DELIVERED'], other: ['PENDING'] },
];

const ctx = {};

beforeAll(async () => {
  ctx.seller = await createVendor();
  ctx.other = await createVendor();
  ctx.mine = await createProduct({ vendor: ctx.seller.vendor._id, name: 'Blue Kettle' });
  ctx.theirs = await createProduct({ vendor: ctx.other.vendor._id, name: 'Red Lamp' });
  ctx.buyer = await createCustomer({ name: 'Findable Buyer' });
  ctx.orders = [];
  for (const [n, mix] of LINE_MIXES.entries()) {
    const line = (p, status) => ({ product: p._id, name: p.name, price: 100, quantity: 1, vendor: p.vendor, status });
    ctx.orders.push(
      await Order.create({
        user: ctx.buyer.user._id,
        items: [...mix.mine.map((s) => line(ctx.mine, s)), ...(mix.other || []).map((s) => line(ctx.theirs, s))],
        shippingAddress: ADDRESS,
        subtotal: 100,
        total: 100,
        paymentMethod: 'COD',
        status: mix.orderStatus || 'PENDING',
        createdAt: new Date(Date.now() - n * 60000),
      })
    );
  }
});

describe('seller order list', () => {
  const list = (query = '') => as(ctx.seller.token).get(`/vendor/orders?${query}`);

  test('every tab count equals the serializer’s status for each order', async () => {
    const expected = { all: LINE_MIXES.length, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    const fresh = await Order.find({ _id: { $in: ctx.orders.map((o) => o._id) } });
    for (const o of fresh) expected[serializeVendorOrder(o, String(ctx.seller.vendor._id)).status.toLowerCase()] += 1;
    const res = await list();
    expect(res.body.data.tabCounts).toEqual(expected);
  });

  test('each tab lists exactly the orders whose row shows that status', async () => {
    for (const tab of ['pending', 'processing', 'shipped', 'delivered', 'cancelled']) {
      const res = await list(`tab=${tab}&rowsPerPage=100`);
      expect(res.body.data.items.every((o) => o.status === tab.toUpperCase())).toBe(true);
      expect(res.body.data.totalItems).toBe(res.body.data.tabCounts[tab]);
    }
  });

  test('pages are newest first, non-overlapping, and complete', async () => {
    const p1 = await list('rowsPerPage=5&page=1');
    const p2 = await list('rowsPerPage=5&page=2');
    const p3 = await list('rowsPerPage=5&page=3');
    const ids = [...p1.body.data.items, ...p2.body.data.items, ...p3.body.data.items].map((o) => o.id);
    expect(ids).toEqual(ctx.orders.map((o) => String(o._id)));
    expect(p1.body.data.totalPages).toBe(3);
  });

  test('search: own line name, buyer name, order id — never the other seller’s line', async () => {
    expect((await list('search=kettle')).body.data.totalItems).toBe(LINE_MIXES.length);
    expect((await list('search=lamp')).body.data.totalItems).toBe(0);
    expect((await list('search=findable')).body.data.totalItems).toBe(LINE_MIXES.length);
    const id = String(ctx.orders[3]._id);
    expect((await list(`search=${id.slice(-8)}`)).body.data.items.map((o) => o.id)).toEqual([id]);
  });

  test('rows still only carry the seller’s own lines', async () => {
    const res = await list('rowsPerPage=100');
    for (const o of res.body.data.items) expect(o.items.every((i) => i.name === 'Blue Kettle')).toBe(true);
  });
});

describe('admin order list', () => {
  let admin;
  beforeAll(async () => {
    admin = as((await createAdmin()).token);
  });

  test('pages in the database with the same envelope', async () => {
    const res = await admin.get('/admin/orders?rowsPerPage=4&page=2');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(4);
    expect(res.body.data).toMatchObject({ page: 2, rowsPerPage: 4 });
    expect(res.body.data.totalItems).toBeGreaterThanOrEqual(LINE_MIXES.length);
    expect(res.body.data.tabCounts.all).toBe(res.body.data.totalItems);
  });

  test('search by buyer name and by order id fragment', async () => {
    const byName = await admin.get('/admin/orders?search=Findable&rowsPerPage=100');
    expect(byName.body.data.totalItems).toBe(LINE_MIXES.length);
    const id = String(ctx.orders[5]._id);
    const byId = await admin.get(`/admin/orders?search=${id.slice(-10)}`);
    expect(byId.body.data.items.map((o) => o.id)).toEqual([id]);
    expect((await admin.get('/admin/orders?search=(')).status).toBe(200);
  });

  test('sort by total ascending happens across pages, not within one', async () => {
    await Order.updateOne({ _id: ctx.orders[7]._id }, { $set: { total: 1 } });
    const res = await admin.get('/admin/orders?sort=total:asc&rowsPerPage=1');
    expect(res.body.data.items[0].id).toBe(String(ctx.orders[7]._id));
  });
});
