// QA-014 (perf) regression: the admin product list pages on the server.
// It used to return the whole catalogue on every call (2.6 MB at 3,000
// products; 100% timeouts with 10 admins in the load test).

const Product = require('../../Models/Product');
const Brand = require('../../Models/Brand');
const {
  connectTestDb,
  disconnectTestDb,
  createAdmin,
  createCategory,
  createProduct,
  as,
} = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const ctx = {};

beforeAll(async () => {
  await Product.deleteMany({});
  const { token } = await createAdmin();
  ctx.admin = as(token);
  ctx.shoes = await createCategory({ name: 'Footwear QA' });
  ctx.other = await createCategory({ name: 'Kitchen QA' });
  ctx.brand = await Brand.create({ name: 'Zebra QA', isActive: true });
  // 30 products: prices 10..300, every 5th inactive, every 6th out of stock,
  // every 7th trending, the first 4 in Footwear.
  for (let i = 1; i <= 30; i += 1) {
    await createProduct({
      name: `Item ${String(i).padStart(2, '0')}`,
      sku: `QA-PG-${i}`,
      price: i * 10,
      salePrice: i === 30 ? 5 : undefined, // cheapest by effective price
      isActive: i % 5 !== 0,
      stock: i % 6 === 0 ? 0 : 10,
      isTrending: i % 7 === 0,
      category: i <= 4 ? ctx.shoes._id : ctx.other._id,
      brand: i === 12 ? ctx.brand._id : null,
    });
  }
});

const page = (query) => ctx.admin.get(`/admin/catalog/products?${new URLSearchParams(query)}`);

test('returns one page, the filtered total, and every tab count', async () => {
  const res = await page({ page: 1, limit: 10 });
  expect(res.status).toBe(200);
  expect(res.body.data.items).toHaveLength(10);
  expect(res.body.pagination).toMatchObject({ page: 1, limit: 10, total: 30, totalPages: 3 });
  expect(res.body.data.stats).toMatchObject({ total: 30, active: 24, inactive: 6, outOfStock: 5, trending: 4 });
});

test('tabs filter on the server', async () => {
  expect((await page({ page: 1, status: 'inactive' })).body.pagination.total).toBe(6);
  expect((await page({ page: 1, status: 'out_of_stock' })).body.pagination.total).toBe(5);
  expect((await page({ page: 1, status: 'trending' })).body.pagination.total).toBe(4);
});

test('search matches name, SKU, category name and brand name — literally', async () => {
  expect((await page({ page: 1, search: 'Item 0' })).body.pagination.total).toBe(9);
  expect((await page({ page: 1, search: 'QA-PG-17' })).body.data.items.map((p) => p.name)).toEqual(['Item 17']);
  expect((await page({ page: 1, search: 'footwear' })).body.pagination.total).toBe(4);
  expect((await page({ page: 1, search: 'zebra' })).body.data.items.map((p) => p.name)).toEqual(['Item 12']);
  expect((await page({ page: 1, search: '.*' })).body.pagination.total).toBe(0);
});

test('price sort uses the price a buyer pays (sale price when set), across pages', async () => {
  const first = await page({ page: 1, limit: 3, sort: 'price-asc' });
  expect(first.body.data.items.map((p) => p.name)).toEqual(['Item 30', 'Item 01', 'Item 02']);
  const last = await page({ page: 10, limit: 3, sort: 'price-asc' });
  expect(last.body.data.items.map((p) => p.name)).toEqual(['Item 27', 'Item 28', 'Item 29']);
});

test('pages never overlap and together cover everything', async () => {
  const seen = new Set();
  for (let p = 1; p <= 3; p += 1) {
    for (const item of (await page({ page: p, limit: 10, sort: 'name-asc' })).body.data.items) seen.add(item.id);
  }
  expect(seen.size).toBe(30);
});

test('the unpaged form (order-form product picker) still returns the whole list', async () => {
  const res = await ctx.admin.get('/admin/catalog/products');
  expect(res.body.data.items).toHaveLength(30);
  expect(res.body.data.stats.total).toBe(30);
});
