const request = require('supertest');
const app = require('../app');
const { connectTestDb, disconnectTestDb, createCustomer, createProduct } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('cart stock enforcement', () => {
  it('clamps requested quantity to available stock', async () => {
    const { token } = await createCustomer();
    const product = await createProduct({ stock: 2 });

    const res = await request(app)
      .post('/user/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 5 });

    expect(res.status).toBe(200);

    const cart = await request(app).get('/user/cart').set('Authorization', `Bearer ${token}`);
    const line = cart.body.data.items.find((i) => i.id === product._id.toString());
    expect(line.quantity).toBe(2);
  });

  it('refuses to add an out-of-stock product', async () => {
    const { token } = await createCustomer();
    const product = await createProduct({ stock: 0 });

    const res = await request(app)
      .post('/user/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1 });

    expect(res.status).toBe(400);
  });

  it('refuses to add a deactivated product', async () => {
    const { token } = await createCustomer();
    const product = await createProduct({ isActive: false });

    const res = await request(app)
      .post('/user/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1 });

    expect(res.status).toBe(404);
  });

  it('never accepts a client-supplied price on the cart line', async () => {
    const { token } = await createCustomer();
    const product = await createProduct({ price: 999, stock: 5 });

    await request(app)
      .post('/user/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1, price: 1 });

    const cart = await request(app).get('/user/cart').set('Authorization', `Bearer ${token}`);
    const line = cart.body.data.items.find((i) => i.id === product._id.toString());
    expect(line.price).toBe(999);
  });
});
