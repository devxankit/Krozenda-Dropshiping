const request = require('supertest');
const app = require('../app');
const { connectTestDb, disconnectTestDb, createProduct } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('product reviews are publicly readable (regression)', () => {
  it('an unauthenticated caller can list a product\'s reviews', async () => {
    const product = await createProduct();
    const res = await request(app).get('/user/reviews').query({ productId: product._id.toString() });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('still requires auth to submit or view "reviewable" items', async () => {
    const product = await createProduct();
    const reviewable = await request(app).get('/user/reviews/reviewable');
    expect(reviewable.status).toBe(401);

    const submit = await request(app)
      .post('/user/reviews')
      .send({ productId: product._id.toString(), orderId: '000000000000000000000000', rating: 5 });
    expect(submit.status).toBe(401);
  });
});
