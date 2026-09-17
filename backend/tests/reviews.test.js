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
    // `data` was a bare array before this endpoint was paginated; it is now
    // the standard { items, total, summary } envelope. The point of the
    // regression — that no token is required to read it — is unchanged.
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 10 });
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
