// Admin and seller product forms: variants travel as a JSON field inside the multipart
// body and are stored with their own price, cost, stock, weight and attributes.
const request = require('supertest');
const app = require('../app');
const Product = require('../Models/Product');
const { connectTestDb, disconnectTestDb, createAdmin, createCategory, createVendor } = require('./helpers');

beforeAll(async () => {
  await connectTestDb();
  await Product.init();
});
afterAll(disconnectTestDb);

function variant(overrides = {}) {
  return {
    name: 'Black / XL',
    sku: `V-${Math.random().toString(36).slice(2, 8)}`,
    attributes: { Color: 'Black', Size: 'XL' },
    price: 1599,
    salePrice: 1299,
    costPrice: 800,
    stock: 25,
    weight: 0.75,
    isActive: true,
    ...overrides,
  };
}

async function post(token, fields) {
  const req = request(app).post('/admin/catalog/products').set('Authorization', `Bearer ${token}`);
  for (const [k, v] of Object.entries(fields)) req.field(k, typeof v === 'string' ? v : JSON.stringify(v));
  return req;
}

async function baseFields() {
  const category = await createCategory();
  return {
    name: 'Running Shoes',
    sku: `P-${Math.random().toString(36).slice(2, 8)}`,
    category: String(category._id),
    price: '1999',
    stock: '0',
    weight: '1',
    images: ['/uploads/products/a.webp'],
  };
}

describe('admin product variants', () => {
  it('stores every variant field', async () => {
    const { token } = await createAdmin();
    const res = await post(token, {
      ...(await baseFields()),
      variants: [variant({ image: '/uploads/products/a.webp' }), variant({ name: 'White / 8', attributes: { Color: 'White', Size: '8' }, weight: null })],
    });

    expect(res.status).toBe(201);
    const [v1, v2] = res.body.data.variants;
    expect(v1).toMatchObject({ name: 'Black / XL', price: 1599, salePrice: 1299, costPrice: 800, stock: 25, weight: 0.75 });
    expect(v1.attributes).toEqual({ Color: 'Black', Size: 'XL' });
    expect(v1.image).toContain('/uploads/products/a.webp');
    expect(v2.weight).toBeNull();
  });

  it('keeps variant ids on update and removes the ones left out', async () => {
    const { token } = await createAdmin();
    const created = await post(token, { ...(await baseFields()), variants: [variant(), variant({ name: 'Red / S' })] });
    const [keep] = created.body.data.variants;

    const res = await request(app)
      .put(`/admin/catalog/products/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('variants', JSON.stringify([{ ...variant({ sku: keep.sku }), id: keep.id, stock: 3 }]));

    expect(res.status).toBe(200);
    expect(res.body.data.variants).toHaveLength(1);
    expect(res.body.data.variants[0].id).toBe(keep.id);
    expect(res.body.data.variants[0].stock).toBe(3);
  });

  it('refuses a selling price above the MRP', async () => {
    const { token } = await createAdmin();
    const res = await post(token, { ...(await baseFields()), variants: [variant({ price: 1000, salePrice: 1200 })] });
    expect(res.status).toBe(400);
  });

  it('refuses two variants with the same SKU', async () => {
    const { token } = await createAdmin();
    const res = await post(token, { ...(await baseFields()), variants: [variant({ sku: 'DUP' }), variant({ sku: 'dup' })] });
    expect(res.status).toBe(400);
  });
});

describe('seller product variants', () => {
  it('stores every variant field', async () => {
    const { token } = await createVendor();
    const req = request(app).post('/vendor/products').set('Authorization', `Bearer ${token}`);
    for (const [k, v] of Object.entries(await baseFields())) req.field(k, typeof v === 'string' ? v : JSON.stringify(v));
    const res = await req.field('variants', JSON.stringify([variant({ image: '/uploads/products/a.webp' })]));

    expect(res.status).toBe(201);
    expect(res.body.data.variants[0]).toMatchObject({ price: 1599, salePrice: 1299, costPrice: 800, stock: 25, weight: 0.75 });
    expect(res.body.data.variants[0].attributes).toEqual({ Color: 'Black', Size: 'XL' });
  });

  it('refuses two variants with the same SKU', async () => {
    const { token } = await createVendor();
    const req = request(app).post('/vendor/products').set('Authorization', `Bearer ${token}`);
    for (const [k, v] of Object.entries(await baseFields())) req.field(k, typeof v === 'string' ? v : JSON.stringify(v));
    const res = await req.field('variants', JSON.stringify([variant({ sku: 'X1' }), variant({ sku: 'x1' })]));
    expect(res.status).toBe(400);
  });
});
