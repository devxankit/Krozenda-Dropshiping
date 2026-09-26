jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const request = require('supertest');
const app = require('../app');
const Order = require('../Models/Order');
const PlatformSettings = require('../Models/PlatformSettings');
const { connectTestDb, disconnectTestDb, createCustomer, createProduct, createAddress } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

let original;
beforeAll(async () => {
  const settings = await PlatformSettings.getSettings();
  original = {
    defaultGstRate: settings.defaultGstRate,
    buyerPlatformFeeType: settings.buyerPlatformFeeType,
    buyerPlatformFeeValue: settings.buyerPlatformFeeValue,
  };
});
afterEach(async () => {
  await PlatformSettings.updateOne({ key: 'GLOBAL' }, { $set: original });
});

async function setSettings(values) {
  await PlatformSettings.getSettings();
  await PlatformSettings.updateOne({ key: 'GLOBAL' }, { $set: values });
}

async function buyerWithCart(product, quantity = 1) {
  const { user, token } = await createCustomer();
  const address = await createAddress(user._id);
  await request(app)
    .post('/user/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: product._id.toString(), quantity });
  return { token, address };
}

function quote(token, address) {
  return request(app)
    .post('/user/orders/shipping-quote')
    .set('Authorization', `Bearer ${token}`)
    .send({ addressId: address._id.toString(), paymentMethod: 'COD' });
}

describe('checkout GST', () => {
  it('shows GST inside an inclusive price without changing the total', async () => {
    await setSettings({ buyerPlatformFeeValue: 0 });
    const product = await createProduct({ price: 1180, stock: 5, gstRate: 18, gstInclusive: true });
    const { token, address } = await buyerWithCart(product);

    const res = await quote(token, address);
    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.tax.listSubtotal).toBe(1180);
    expect(data.tax.gstIncluded).toBe(180);
    expect(data.tax.gstAdded).toBe(0);
    expect(data.total).toBe(1180 + data.shippingFee);
  });

  it('adds GST on top of an exclusive price, and the order charges it', async () => {
    await setSettings({ buyerPlatformFeeValue: 0 });
    const product = await createProduct({ price: 1000, stock: 5, gstRate: 18, gstInclusive: false });
    const { token, address } = await buyerWithCart(product, 2);

    const res = await quote(token, address);
    const { data } = res.body;
    expect(data.tax.listSubtotal).toBe(2000);
    expect(data.tax.gstAdded).toBe(360);
    expect(data.tax.lines[0]).toMatchObject({ gstRate: 18, gstInclusive: false, gstAmount: 360 });
    expect(data.total).toBe(2360 + data.shippingFee);

    const placed = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD' });
    expect(placed.status).toBe(201);
    expect(placed.body.data.total).toBe(data.total);

    const order = await Order.findById(placed.body.data.id || placed.body.data._id).lean();
    expect(order.items[0]).toMatchObject({ price: 1180, listPrice: 1000, gstInclusive: false, gstRate: 18 });
  });

  it('uses the admin default GST rate when the product has none', async () => {
    await setSettings({ defaultGstRate: 12, buyerPlatformFeeValue: 0 });
    const product = await createProduct({ price: 1000, stock: 5, gstRate: null, gstInclusive: false });
    const { token, address } = await buyerWithCart(product);

    const { data } = (await quote(token, address)).body;
    expect(data.tax.lines[0].gstRate).toBe(12);
    expect(data.tax.gstAdded).toBe(120);
  });
});

describe('buyer platform fee', () => {
  it('adds a percentage fee on the goods to the total', async () => {
    await setSettings({ buyerPlatformFeeType: 'percentage', buyerPlatformFeeValue: 2 });
    const product = await createProduct({ price: 1000, stock: 5, gstRate: 18, gstInclusive: true });
    const { token, address } = await buyerWithCart(product);

    const { data } = (await quote(token, address)).body;
    expect(data.platformFee).toBe(20);
    expect(data.total).toBe(1000 + 20 + data.shippingFee);
  });

  it('adds a flat fee once and stores it on the order', async () => {
    await setSettings({ buyerPlatformFeeType: 'flat', buyerPlatformFeeValue: 15 });
    const product = await createProduct({ price: 500, stock: 5, gstRate: 5, gstInclusive: true });
    const { token, address } = await buyerWithCart(product, 3);

    const { data } = (await quote(token, address)).body;
    expect(data.platformFee).toBe(15);

    const placed = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD' });
    expect(placed.status).toBe(201);
    expect(placed.body.data.total).toBe(1500 + 15 + data.shippingFee);
  });
});
