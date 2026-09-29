// Regression tests for the smaller fixes of round 3 (QA-024, QA-027, QA-029).

const request = require('supertest');
const { sendServerError } = require('../../utils/sendServerError');
const { connectTestDb, disconnectTestDb, createVendor, createCategory, createProduct, app, as } = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
}

describe('QA-027: caught server errors never reach the client', () => {
  test('a driver error is a generic 500; the detail goes to the log only', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = sendServerError(fakeRes(), new Error('E11000 duplicate key collection: krozenda.users'), 'Failed to update settings');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Failed to update settings' });
  });

  test('a validation error is the caller’s to fix: 400 with its reason', () => {
    const err = Object.assign(new Error('supportEmail: must be an email'), { name: 'ValidationError' });
    const res = sendServerError(fakeRes(), err, 'Failed to update settings');
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('supportEmail: must be an email');
  });
});

describe('QA-029: seller coupons are capped at 100%', () => {
  test('a 150% seller coupon is refused', async () => {
    const seller = await createVendor();
    const product = await createProduct({ vendor: seller.vendor._id });
    const res = await as(seller.token).post('/vendor/coupons', {
      code: `QA150${Date.now()}`,
      discountType: 'PERCENTAGE',
      discountValue: 150,
      productIds: [String(product._id)],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot exceed 100/);
  });
});

describe('QA-024: seller product rules are the production rules under test too', () => {
  const post = async (token, fields) => {
    const req = request(app).post('/vendor/products').set('Authorization', `Bearer ${token}`);
    for (const [k, v] of Object.entries(fields)) req.field(k, v);
    return req;
  };

  test.each([
    ['SKU', { weight: '0.5', images: '["/uploads/products/a.webp"]' }, /SKU is required/],
    ['weight', { sku: `QA-W-${Date.now()}`, images: '["/uploads/products/a.webp"]' }, /Weight/],
    ['main image', { sku: `QA-I-${Date.now()}`, weight: '0.5' }, /Main image is required/],
  ])('a product without a %s is refused', async (_label, extra, message) => {
    const { token } = await createVendor();
    const category = await createCategory();
    const res = await post(token, { name: 'Missing bits', category: String(category._id), price: '100', stock: '5', ...extra });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });
});
