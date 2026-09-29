// Admin Invoices (QA-033): GET /admin/invoices and /admin/invoices/:id are
// derived from the same invoiceService the buyer's invoice uses, so the two
// must always agree.

const Order = require('../../Models/Order');
const PlatformSettings = require('../../Models/PlatformSettings');
const {
  connectTestDb,
  disconnectTestDb,
  createAdmin,
  createCustomer,
  createVendor,
  createCategory,
  createProduct,
  createStaff,
  uniqueSuffix,
  as,
} = require('./qaHelpers');

let admin;
let buyer;
let category;
let gujaratSeller;
let unregisteredSeller;
// Every order here is placed for a buyer with this name, so a search for it
// isolates this file's invoices from anything else in the database.
let buyerName;

beforeAll(async () => {
  await connectTestDb();
  const settings = await PlatformSettings.getSettings();
  settings.gstin = '27AAECK4821M1Z9';
  settings.legalEntity = 'Krozenda Commerce Private Limited';
  settings.registeredAddress = { addressLine: 'BKC', city: 'Mumbai', state: 'Maharashtra', pincode: '400051' };
  await settings.save();

  ({ token: admin } = await createAdmin());
  buyer = await createCustomer();
  category = await createCategory();
  buyerName = `Invoice Buyer ${uniqueSuffix()}`;
  ({ vendor: gujaratSeller } = await createVendor({
    name: 'Asha',
    business: { businessName: 'Asha Traders LLP', gstin: '24ABCDE1234F1Z5' },
    address: { addressLine: 'CG Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009' },
  }));
  ({ vendor: unregisteredSeller } = await createVendor({ name: 'Small Shop', address: { state: 'Maharashtra' } }));
});
afterAll(disconnectTestDb);

// Prices are GST-inclusive: ₹1180 at 18% is ₹1000 taxable + ₹180 tax.
const line = (product, { price = 1180, vendor = null } = {}) => ({
  product: product._id,
  name: product.name,
  price,
  quantity: 1,
  vendor,
  gstRate: 18,
  taxableValue: 1,
});

async function placeOrder(items, { paymentMethod = 'RAZORPAY', paymentStatus = 'PAID', status = 'PENDING', shippingFee = 0, platformFee = 0 } = {}) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return Order.create({
    user: buyer.user._id,
    items,
    shippingAddress: { fullName: buyerName, phone: '9998887771', line1: '1 Test St', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    subtotal,
    shippingFee,
    platformFee,
    total: subtotal + shippingFee + platformFee,
    paymentMethod,
    paymentStatus,
    status,
  });
}

const list = (token, query = '') =>
  as(token).get(`/admin/invoices?search=${encodeURIComponent(buyerName)}&rowsPerPage=100${query}`);

describe('admin invoice list', () => {
  let mixed;

  beforeAll(async () => {
    const own = await createProduct({ category: category._id });
    const sellerProduct = await createProduct({ category: category._id, vendor: gujaratSeller._id });
    const shopProduct = await createProduct({ category: category._id, vendor: unregisteredSeller._id });
    mixed = await placeOrder(
      [line(own), line(sellerProduct, { vendor: gujaratSeller._id }), line(shopProduct, { vendor: unregisteredSeller._id, price: 500 })],
      { shippingFee: 50 }
    );
    // Not invoiced: payment never captured, payment failed, order cancelled.
    await placeOrder([line(own)], { paymentStatus: 'PENDING' });
    await placeOrder([line(own)], { paymentStatus: 'FAILED' });
    await placeOrder([line(own)], { status: 'CANCELLED' });
  });

  test('one row per supplier, with the same figures as the buyer invoice', async () => {
    const res = await list(admin);
    expect(res.status).toBe(200);
    const rows = res.body.data.items.filter((r) => r.orderId === String(mixed._id));
    expect(rows).toHaveLength(3);

    const buyerView = await as(buyer.token).get(`/user/orders/${mixed._id}/invoice`);
    const invoices = buyerView.body.data.invoices;
    rows.forEach((row, i) => {
      expect(row).toMatchObject({
        id: `${mixed._id}-${i + 1}`,
        number: invoices[i].invoiceNumber,
        sellerOfRecord: invoices[i].supplier.name,
        taxableValue: invoices[i].totals.taxable,
        gst: invoices[i].totals.tax,
        total: invoices[i].totals.total,
        buyer: buyerName,
        placeOfSupply: 'Maharashtra',
      });
    });
    // Krozenda's invoice carries the delivery charge; Gujarat → Maharashtra is IGST.
    expect(rows[0]).toMatchObject({ total: 123000, isInterState: false });
    expect(rows[1]).toMatchObject({ total: 118000, isInterState: true });
    expect(rows[2]).toMatchObject({ gst: 0, documentType: 'BILL_OF_SUPPLY' });
  });

  test('unpaid, failed and cancelled orders have no invoice', async () => {
    const res = await list(admin);
    const orderIds = new Set(res.body.data.items.map((r) => r.orderId));
    expect([...orderIds]).toEqual([String(mixed._id)]);
  });

  test('tabs split by supplier and by inter-state supply, with counts', async () => {
    const res = await list(admin);
    expect(res.body.data.tabCounts).toEqual({ all: 3, krozenda: 1, vendor: 2, inter_state: 1 });

    const vendorTab = await list(admin, '&tab=vendor');
    expect(vendorTab.body.data.items.map((r) => r.sellerOfRecord)).toEqual(['Asha Traders LLP', 'Small Shop']);
    expect(vendorTab.body.data.totalItems).toBe(2);

    const inter = await list(admin, '&tab=inter_state');
    expect(inter.body.data.items).toHaveLength(1);
    expect(inter.body.data.items[0].isInterState).toBe(true);
  });

  test('listing does not issue (freeze) the invoice', async () => {
    // Another buyer, so this order stays out of the other tests' rows.
    const own = await createProduct({ category: category._id });
    const other = await createCustomer();
    const order = await Order.create({
      user: other.user._id,
      items: [line(own)],
      shippingAddress: { fullName: 'Unopened Invoice', phone: '9998887772', line1: '2 Test St', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
      subtotal: 1180,
      total: 1180,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PAID',
    });
    const res = await as(admin).get('/admin/invoices?search=Unopened%20Invoice');
    expect(res.body.data.items).toHaveLength(1);

    const fresh = await Order.findById(order._id).select('invoiceSuppliers invoiceGeneratedAt').lean();
    expect(fresh.invoiceSuppliers).toBeUndefined();
    expect(fresh.invoiceGeneratedAt).toBeNull();
  });

  test('pages through the rows', async () => {
    const res = await as(admin).get(`/admin/invoices?search=${encodeURIComponent(buyerName)}&rowsPerPage=2&page=2`);
    expect(res.body.data).toMatchObject({ page: 2, rowsPerPage: 2, totalItems: 3, totalPages: 2 });
    expect(res.body.data.items).toHaveLength(1);
  });
});

describe('admin invoice detail', () => {
  test('the seller invoice in full: parties, lines and tax split', async () => {
    const sellerProduct = await createProduct({ category: category._id, vendor: gujaratSeller._id });
    const order = await placeOrder([line(sellerProduct, { vendor: gujaratSeller._id })], { paymentMethod: 'COD', paymentStatus: 'PENDING' });

    const res = await as(admin).get(`/admin/invoices/${order._id}-1`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      sellerOfRecord: expect.any(String),
      taxType: 'INTER',
      isInterState: true,
      paymentStatus: 'Cash on delivery (not yet collected)',
      seller: { name: 'Asha Traders LLP', gstin: '24ABCDE1234F1Z5', state: 'Gujarat (24)' },
      buyerDetail: { name: buyerName, gstin: null, address: '1 Test St, Pune, Maharashtra, 411001' },
      taxableValue: 100000,
      gst: 18000,
      total: 118000,
    });
    expect(res.body.data.lines).toEqual([
      expect.objectContaining({ quantity: 1, unitPrice: 118000, taxableValue: 100000, gstRate: 18, igst: 18000, cgst: 0, sgst: 0, total: 118000 }),
    ]);

    // Opening the invoice issues it, exactly as the buyer opening theirs does.
    const issued = await Order.findById(order._id).select('invoiceSuppliers').lean();
    expect(issued.invoiceSuppliers).toHaveLength(1);
  });

  test('a platform fee alone puts Krozenda on the invoice, not a nameless seller', async () => {
    const sellerProduct = await createProduct({ category: category._id, vendor: gujaratSeller._id });
    const order = await placeOrder([line(sellerProduct, { vendor: gujaratSeller._id })], { platformFee: 10 });

    const res = await as(admin).get(`/admin/invoices/${order._id}-1`);
    expect(res.body.data).toMatchObject({ platformFee: 1000, total: 1000 });
    expect(res.body.data.sellerOfRecord).not.toBe('Seller');
    expect(res.body.data.seller).toMatchObject({ name: 'Krozenda Commerce Private Limited', gstin: '27AAECK4821M1Z9' });
  });

  test('bad, unknown and uninvoiced ids', async () => {
    expect((await as(admin).get('/admin/invoices/not-an-id')).status).toBe(400);
    expect((await as(admin).get('/admin/invoices/64b000000000000000000000-1')).status).toBe(404);

    const own = await createProduct({ category: category._id });
    const unpaid = await placeOrder([line(own)], { paymentStatus: 'PENDING' });
    expect((await as(admin).get(`/admin/invoices/${unpaid._id}-1`)).status).toBe(404);
    const paid = await placeOrder([line(own)]);
    expect((await as(admin).get(`/admin/invoices/${paid._id}-2`)).status).toBe(404);
  });
});

describe('who may read invoices', () => {
  test('staff with the invoices key or order view may; others may not', async () => {
    const { token: invoicesOnly } = await createStaff(['admin.access', 'admin.orders.invoices']);
    const { token: ordersView } = await createStaff(['admin.access', 'admin.orders.view']);
    const { token: support } = await createStaff(['admin.access', 'admin.people.support']);

    expect((await as(invoicesOnly).get('/admin/invoices')).status).toBe(200);
    expect((await as(ordersView).get('/admin/invoices')).status).toBe(200);
    expect((await as(support).get('/admin/invoices')).status).toBe(403);
    expect((await as(null).get('/admin/invoices')).status).toBe(401);
  });
});
