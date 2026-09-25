// Admin sidebar "Own stock" switch (CatalogSettings.sellerOnlyMode, inverted).
// Off: admin's own products leave the storefront and can't be bought; seller
// and dropship (CJ) products are untouched. On: everything is back.
const request = require('supertest');
const app = require('../app');
const Cart = require('../Models/Cart');
const CatalogSettings = require('../Models/CatalogSettings');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createVendor,
  createProduct,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

async function setOwnStock(on) {
  const settings = await CatalogSettings.getSettings();
  settings.sellerOnlyMode = !on;
  await settings.save();
}

describe('own stock switch', () => {
  let adminProduct;
  let sellerProduct;
  let dropshipProduct;

  beforeAll(async () => {
    const { vendor } = await createVendor();
    adminProduct = await createProduct({ name: 'OwnStock Admin Item' });
    sellerProduct = await createProduct({ name: 'OwnStock Seller Item', vendor: vendor._id });
    dropshipProduct = await createProduct({ name: 'OwnStock CJ Item', fulfillmentProvider: 'CJ' });
  });

  afterEach(() => setOwnStock(true));

  const listedIds = async () => {
    const res = await request(app).get('/catalog/products').query({ search: 'OwnStock', limit: 50 });
    expect(res.status).toBe(200);
    return res.body.data.items.map((p) => p.id || p._id);
  };

  it('lists all three kinds while own stock is on', async () => {
    const ids = await listedIds();
    expect(ids).toEqual(
      expect.arrayContaining([adminProduct.id, sellerProduct.id, dropshipProduct.id])
    );
  });

  it('hides only admin products from the listing while off', async () => {
    await setOwnStock(false);
    const ids = await listedIds();
    expect(ids).not.toContain(adminProduct.id);
    expect(ids).toEqual(expect.arrayContaining([sellerProduct.id, dropshipProduct.id]));
  });

  it('answers 404 for an admin product detail while off', async () => {
    await setOwnStock(false);
    const hidden = await request(app).get(`/catalog/products/${adminProduct.id}`);
    expect(hidden.status).toBe(404);
    const seller = await request(app).get(`/catalog/products/${sellerProduct.id}`);
    expect(seller.status).toBe(200);
  });

  it('refuses to add an admin product to the cart and flags one already there', async () => {
    const { user, token } = await createCustomer();
    await Cart.create({ user: user._id, items: [{ product: adminProduct._id, quantity: 1, priceAtAdd: 1000 }] });

    await setOwnStock(false);

    const add = await request(app)
      .post('/user/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: adminProduct.id, quantity: 1 });
    expect(add.status).toBe(404);

    const cart = await request(app).get('/user/cart').set('Authorization', `Bearer ${token}`);
    expect(cart.status).toBe(200);
    const line = cart.body.data.items.find((item) => item.id === adminProduct.id);
    expect(line.availability).toBe('UNAVAILABLE');
  });

  it('reports the switch on the public catalog settings', async () => {
    await setOwnStock(false);
    const res = await request(app).get('/catalog/products/settings');
    expect(res.body.data.ownStockEnabled).toBe(false);
  });
});
