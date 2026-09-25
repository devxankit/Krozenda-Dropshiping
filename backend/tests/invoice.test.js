const request = require('supertest');
const app = require('../app');
const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const PlatformSettings = require('../Models/PlatformSettings');
const { splitInclusive } = require('../services/invoiceService');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createVendor,
  createCategory,
  createProduct,
} = require('./helpers');

beforeAll(async () => {
  await connectTestDb();
  const settings = await PlatformSettings.getSettings();
  settings.gstin = '27AAECK4821M1Z9';
  settings.legalEntity = 'Krozenda Commerce Private Limited';
  settings.registeredAddress = { addressLine: 'BKC', city: 'Mumbai', state: 'Maharashtra', pincode: '400051' };
  await settings.save();
});
afterAll(disconnectTestDb);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

function address(state) {
  return { fullName: 'Rehan Multani', phone: '9998887771', line1: '1 Test St', city: 'City', state, pincode: '400001' };
}

// Prices are GST-inclusive, so ₹1180 at 18% is ₹1000 taxable + ₹180 tax.
function line(product, { price = 1180, quantity = 1, vendor = null, gstRate = 18 } = {}) {
  return {
    product: product._id,
    name: product.name,
    price,
    quantity,
    vendor,
    gstRate,
    taxableValue: 1, // marks the GST rate as snapshotted at order time
  };
}

async function placeOrder(user, items, { state = 'Maharashtra', fulfillmentType = 'STANDARD', shippingFee = 0 } = {}) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return Order.create({
    user: user._id,
    items,
    shippingAddress: address(state),
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    fulfillmentType,
  });
}

describe('customer invoice — whose GSTIN', () => {
  let buyer;
  let category;
  let gujaratSeller;
  let unregisteredSeller;

  beforeAll(async () => {
    buyer = await createCustomer();
    category = await createCategory();
    ({ vendor: gujaratSeller } = await createVendor({
      name: 'Asha',
      business: { businessName: 'Asha Traders LLP', gstin: '24ABCDE1234F1Z5' },
      address: { addressLine: 'CG Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009' },
    }));
    ({ vendor: unregisteredSeller } = await createVendor({
      name: 'Small Shop',
      address: { state: 'Maharashtra' },
    }));
  });

  test('one invoice per supplier: Krozenda for own stock, each seller for theirs', async () => {
    const own = await createProduct({ category: category._id });
    const sellerProduct = await createProduct({ category: category._id, vendor: gujaratSeller._id });
    const shopProduct = await createProduct({ category: category._id, vendor: unregisteredSeller._id });

    const order = await placeOrder(
      buyer.user,
      [
        line(own),
        line(sellerProduct, { vendor: gujaratSeller._id }),
        line(shopProduct, { vendor: unregisteredSeller._id, price: 500 }),
      ],
      { shippingFee: 50 }
    );

    const res = await request(app).get(`/user/orders/${order._id}/invoice`).set(auth(buyer.token));
    expect(res.status).toBe(200);
    const [platform, seller, shop] = res.body.data.invoices;

    // Own stock → Krozenda's GSTIN; Maharashtra to Maharashtra is CGST + SGST.
    expect(platform.supplier).toMatchObject({ kind: 'PLATFORM', gstin: '27AAECK4821M1Z9', stateCode: '27' });
    expect(platform.taxType).toBe('INTRA');
    expect(platform.totals).toMatchObject({ taxable: 100000, cgst: 9000, sgst: 9000, igst: 0, shipping: 5000, total: 123000 });

    // Seller's line → the seller's GSTIN; Gujarat to Maharashtra is IGST.
    expect(seller.supplier).toMatchObject({ kind: 'SELLER', gstin: '24ABCDE1234F1Z5', legalName: 'Asha Traders LLP' });
    expect(seller.taxType).toBe('INTER');
    expect(seller.totals).toMatchObject({ taxable: 100000, igst: 18000, cgst: 0, sgst: 0, total: 118000 });
    expect(seller.shipping).toBeNull();

    // A seller without a GSTIN cannot charge GST: Bill of Supply, no tax.
    expect(shop.documentType).toBe('BILL_OF_SUPPLY');
    expect(shop.supplier.gstin).toBe('');
    expect(shop.totals).toMatchObject({ tax: 0, total: 50000 });

    expect(res.body.data.invoices.map((i) => i.invoiceNumber)).toEqual([
      expect.stringMatching(/-1$/),
      expect.stringMatching(/-2$/),
      expect.stringMatching(/-3$/),
    ]);
    expect(res.body.data.grandTotal).toBe(123000 + 118000 + 50000);
  });

  test('a CJ Dropshipping order is invoiced by Krozenda, under the platform GSTIN', async () => {
    const cjProduct = await createProduct({ category: category._id, fulfillmentProvider: 'CJ' });
    const order = await placeOrder(buyer.user, [line(cjProduct)], { fulfillmentType: 'DROPSHIP', state: 'Karnataka' });

    const res = await request(app).get(`/user/orders/${order._id}/invoice`).set(auth(buyer.token));
    expect(res.body.data.invoices).toHaveLength(1);
    const [invoice] = res.body.data.invoices;
    expect(invoice.supplier).toMatchObject({ kind: 'PLATFORM', gstin: '27AAECK4821M1Z9' });
    expect(invoice.taxType).toBe('INTER');
    expect(invoice.totals.igst).toBe(18000);
    expect(invoice.invoiceNumber).not.toMatch(/-\d$/);
  });

  test('an issued invoice keeps the GSTIN it was issued with', async () => {
    const sellerProduct = await createProduct({ category: category._id, vendor: gujaratSeller._id });
    const order = await placeOrder(buyer.user, [line(sellerProduct, { vendor: gujaratSeller._id })]);

    await request(app).get(`/user/orders/${order._id}/invoice`).set(auth(buyer.token));
    await Vendor.updateOne({ _id: gujaratSeller._id }, { $set: { 'business.gstin': '29ABCDE1234F1Z5' } });

    const again = await request(app).get(`/user/orders/${order._id}/invoice`).set(auth(buyer.token));
    expect(again.body.data.invoices[0].supplier.gstin).toBe('24ABCDE1234F1Z5');
    await Vendor.updateOne({ _id: gujaratSeller._id }, { $set: { 'business.gstin': '24ABCDE1234F1Z5' } });
  });

  test('another buyer cannot read the invoice', async () => {
    const own = await createProduct({ category: category._id });
    const order = await placeOrder(buyer.user, [line(own)]);
    const stranger = await createCustomer();
    const res = await request(app).get(`/user/orders/${order._id}/invoice`).set(auth(stranger.token));
    expect(res.status).toBe(404);
  });

  test('GST is taken out of an inclusive price', () => {
    expect(splitInclusive(118000, 18)).toEqual({ taxable: 100000, tax: 18000 });
    expect(splitInclusive(50000, 0)).toEqual({ taxable: 50000, tax: 0 });
  });
});
