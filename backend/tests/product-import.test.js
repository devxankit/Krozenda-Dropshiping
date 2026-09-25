// Image downloads are replaced with a stub: these tests are about the import
// lifecycle, and the network is not something a test suite should depend on.
// A URL containing "broken" fails the way a dead link would.
jest.mock('../services/productImport/remoteImage', () => {
  const actual = jest.requireActual('../services/productImport/remoteImage');
  let n = 0;
  return {
    ...actual,
    fetchAndStoreImage: jest.fn(async (url) => {
      if (url.includes('broken')) throw new actual.RemoteImageError('the server answered HTTP 404');
      n += 1;
      return `/uploads/products/import-test-${n}.webp`;
    }),
    deleteStagedImage: jest.fn(async () => {}),
  };
});

const request = require('supertest');
const app = require('../app');
const Product = require('../Models/Product');
const ProductImport = require('../Models/ProductImport');
const CatalogSettings = require('../Models/CatalogSettings');
const remoteImage = require('../services/productImport/remoteImage');
const { isPrivateIp } = jest.requireActual('../services/productImport/remoteImage');
const {
  connectTestDb,
  disconnectTestDb,
  createAdmin,
  createVendor,
  createCategory,
  createProduct,
  uniqueSuffix,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const HEADER =
  'name,sku,category,brand,price,salePrice,stock,weight,gstRate,images,variantName,variantAttributes,variantSku,variantStock';
const csv = (rows) => Buffer.from([HEADER, ...rows].join('\r\n'), 'utf8');
const IMG = 'https://cdn.example.com/p.jpg';

// Processing runs in the background after the upload responds, so tests poll
// the batch the same way the import screen does.
async function waitForReview(base, token, id) {
  for (let i = 0; i < 100; i += 1) {
    const res = await request(app).get(`${base}/${id}`).set(auth(token));
    if (res.body.data.status !== 'PROCESSING') return res.body.data;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('import never finished processing');
}

async function upload(base, token, rows, fields = {}) {
  let req = request(app).post(base).set(auth(token));
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  const res = await req.attach('file', csv(rows), 'products.csv');
  if (res.status !== 202) return { res };
  const batch = await waitForReview(base, token, res.body.data.id);
  const rowsRes = await request(app).get(`${base}/${batch.id}/rows`).set(auth(token));
  return { res, batch, rows: rowsRes.body.data };
}

const VENDOR_BASE = '/vendor/products/import';
const ADMIN_BASE = '/admin/catalog/import';

beforeEach(async () => {
  await CatalogSettings.updateOne(
    { key: 'GLOBAL' },
    { $set: { autoApprovalEnabled: false, sellerOnlyMode: false } },
    { upsert: true }
  );
});

describe('CSV product import — upload and preview', () => {
  it('serves a template with the expected columns', async () => {
    const { token } = await createVendor();
    const res = await request(app).get(`${VENDOR_BASE}/template`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text[/]csv/);
    expect(res.text).toMatch(/^name,sku,category/);
    expect(res.text).toContain('images');
    expect(res.text).toContain('variantName');
  });

  it('refuses a file missing a required column', async () => {
    const { token } = await createVendor();
    const res = await request(app)
      .post(VENDOR_BASE)
      .set(auth(token))
      .attach('file', Buffer.from('name,price\r\nNo Category,100', 'utf8'), 'p.csv');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/missing required columns: sku, category/i);
  });

  it('adds valid seller rows to their product list as hidden Draft previews, and reports the rest', async () => {
    const { vendor, token } = await createVendor();
    const category = await createCategory({ name: `Import ${uniqueSuffix()}` });
    const good = `GOOD-${uniqueSuffix()}`;

    const { res, batch, rows } = await upload(VENDOR_BASE, token, [
      `Good One,${good},${category.name},,500,450,10,0.5,18,${IMG}|https://cdn.example.com/q.jpg,,,,`,
      `Bad Category,BAD1-${uniqueSuffix()},No Such Category,,500,,10,0.5,,${IMG},,,,`,
      `Bad Price,BAD2-${uniqueSuffix()},${category.name},,abc,,10,0.5,,${IMG},,,,`,
      `No Image,BAD3-${uniqueSuffix()},${category.name},,500,,10,0.5,,,,,,`,
      `Dead Link,BAD4-${uniqueSuffix()},${category.name},,500,,10,0.5,,https://cdn.example.com/broken.jpg,,,,`,
    ]);

    expect(res.status).toBe(202);
    expect(batch).toMatchObject({ mode: 'PREVIEW', status: 'PENDING_REVIEW' });
    expect(batch.counts).toMatchObject({ totalRows: 5, products: 5, valid: 1, invalid: 4, created: 1 });

    // The valid row is a real product already — but a hidden, unsubmitted one.
    const [product] = await Product.find({ vendor: vendor._id }).lean();
    expect(product).toMatchObject({
      sku: good,
      name: 'Good One',
      price: 500,
      salePrice: 450,
      status: 'Draft',
      isActive: false,
      importPreview: true,
      approvalStatus: 'PENDING',
    });
    expect(product.images).toHaveLength(2);

    const [ok, badCat, badPrice, noImage, deadLink] = rows;
    expect(ok.status).toBe('CREATED');
    // Line numbers match the spreadsheet gutter (header is line 1).
    expect(badCat.lines).toEqual([3]);
    expect(badCat.errors[0]).toMatch(/category/i);
    expect(badPrice.errors[0]).toMatch(/price/i);
    expect(noImage.errors).toContain('at least one image URL is required');
    expect(deadLink.errors[0]).toMatch(/could not be downloaded: the server answered HTTP 404/);

    // The seller's list shows it under its own tab, not as "pending approval".
    const list = await request(app).get('/vendor/products').set(auth(token));
    expect(list.body.data.tabCounts).toMatchObject({ preview: 1, pending: 0 });
    expect(list.body.data.items[0]).toMatchObject({ sku: good, importPreview: true });
  });

  it('groups lines that share a SKU into one product with variants', async () => {
    const { token } = await createVendor();
    const category = await createCategory({ name: `Variants ${uniqueSuffix()}` });
    const sku = `TEE-${uniqueSuffix()}`;

    const { batch, rows } = await upload(VENDOR_BASE, token, [
      `Tee,${sku},${category.name},,799,,,0.3,,${IMG},Red / L,Color:Red|Size:L,${sku}-RL,5`,
      `,${sku},,,,,,,,,Blue / M,Color:Blue|Size:M,${sku}-BM,7`,
    ]);

    expect(batch.counts).toMatchObject({ totalRows: 2, products: 1, valid: 1 });
    expect(rows[0].lines).toEqual([2, 3]);
    expect(rows[0].product.variants.map((v) => v.name)).toEqual(['Red / L', 'Blue / M']);
    expect(rows[0].product.variants[0].attributes).toEqual({ Color: 'Red', Size: 'L' });
    // Parent stock defaults to the variants' total.
    expect(rows[0].product.stock).toBe(12);
  });

  it("flags a SKU that belongs to someone else's product", async () => {
    const { token } = await createVendor();
    const { vendor: other } = await createVendor();
    const category = await createCategory();
    const taken = await createProduct({ sku: `TAKEN-${uniqueSuffix()}`, vendor: other._id, category });

    const { rows } = await upload(VENDOR_BASE, token, [`Mine,${taken.sku},${category.name},,100,,1,0.2,,${IMG},,,,`]);
    expect(rows[0].status).toBe('INVALID');
    expect(rows[0].errors[0]).toMatch(/already used by another listing/);
  });

  it("keeps each owner's imports private", async () => {
    const { token } = await createVendor();
    const { token: otherToken } = await createVendor();
    const category = await createCategory();
    const { batch } = await upload(VENDOR_BASE, token, [`P,S-${uniqueSuffix()},${category.name},,100,,1,0.2,,${IMG},,,,`]);

    const res = await request(app).get(`${VENDOR_BASE}/${batch.id}`).set(auth(otherToken));
    expect(res.status).toBe(404);
    const approve = await request(app).post(`${VENDOR_BASE}/${batch.id}/approve`).set(auth(otherToken));
    expect(approve.status).toBe(404);
  });
});

describe('CSV product import — rejecting', () => {
  it('rejecting an import discards its previews and closes it', async () => {
    const { vendor, token } = await createVendor();
    const category = await createCategory();
    const { batch } = await upload(VENDOR_BASE, token, [`R,R-${uniqueSuffix()},${category.name},,100,,1,0.2,,${IMG},,,,`]);

    const res = await request(app).post(`${VENDOR_BASE}/${batch.id}/reject`).set(auth(token)).send({ reason: 'Wrong prices' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'REJECTED', rejectionReason: 'Wrong prices' });
    expect(await Product.countDocuments({ vendor: vendor._id })).toBe(0);

    const approve = await request(app).post(`${VENDOR_BASE}/${batch.id}/approve`).set(auth(token));
    expect(approve.status).toBe(409);
  });
});

describe('CSV product import — seller preview mode', () => {
  const queue = async () => {
    const { token } = await createAdmin();
    const res = await request(app).get('/admin/catalog/approvals').set(auth(token));
    return { token, ids: res.body.data.items.map((item) => item.id) };
  };

  it('keeps previews out of the admin approval queue until the seller approves them', async () => {
    const { vendor, token } = await createVendor();
    const category = await createCategory();
    const keep = `KEEP-${uniqueSuffix()}`;
    const wait = `WAIT-${uniqueSuffix()}`;

    await upload(VENDOR_BASE, token, [
      `Keep Me,${keep},${category.name},,300,,4,0.4,,${IMG},,,,`,
      `Wait,${wait},${category.name},,300,,4,0.4,,${IMG},,,,`,
    ]);
    const kept = await Product.findOne({ sku: keep });
    const waiting = await Product.findOne({ sku: wait });

    // Not submitted: the admin neither sees it in the queue nor can decide it.
    const before = await queue();
    expect(before.ids).not.toContain(`product:${kept._id}`);
    const early = await request(app).post(`/admin/catalog/approvals/product:${kept._id}/approve`).set(auth(before.token));
    expect(early.status).toBe(404);

    // Admin's own preview list does not treat it as a platform preview.
    const adminList = await request(app).get(`/admin/catalog/products/${kept._id}`).set(auth(before.token));
    expect(adminList.body.data.importPreview).toBe(false);

    const approve = await request(app)
      .post(`${VENDOR_BASE}/approve-products`)
      .set(auth(token))
      .send({ productIds: [String(kept._id)] });
    expect(approve.status).toBe(200);
    expect(approve.body.data).toEqual({ approved: 1, live: false });
    expect(approve.body.message).toMatch(/submitted/);

    // Submitted exactly like a hand-added product: pending, hidden, queued.
    const fresh = await Product.findById(kept._id).lean();
    expect(fresh).toMatchObject({ importPreview: false, status: 'Active', isActive: false, approvalStatus: 'PENDING' });
    const after = await queue();
    expect(after.ids).toContain(`product:${kept._id}`);
    expect(after.ids).not.toContain(`product:${waiting._id}`);

    const list = await request(app).get('/vendor/products').set(auth(token));
    expect(list.body.data.tabCounts).toMatchObject({ preview: 1, pending: 1 });
    expect(await Product.countDocuments({ vendor: vendor._id })).toBe(2);
  });

  it('goes live on approval when auto-approval is on', async () => {
    await CatalogSettings.updateOne({ key: 'GLOBAL' }, { $set: { autoApprovalEnabled: true } });
    const { token } = await createVendor();
    const category = await createCategory();
    const sku = `AUTO-${uniqueSuffix()}`;
    await upload(VENDOR_BASE, token, [`Auto,${sku},${category.name},,300,,4,0.4,,${IMG},,,,`]);

    // Auto-approval does not skip the seller's own review of the preview.
    expect(await Product.findOne({ sku }).lean()).toMatchObject({ importPreview: true, isActive: false });

    const approve = await request(app).post(`${VENDOR_BASE}/approve-products`).set(auth(token)).send({ all: true });
    expect(approve.body.data).toEqual({ approved: 1, live: true });
    expect(await Product.findOne({ sku }).lean()).toMatchObject({
      importPreview: false,
      isActive: true,
      approvalStatus: 'APPROVED',
    });
  });

  it("cannot approve another seller's previews, and an edit keeps a preview hidden", async () => {
    const { token } = await createVendor();
    const { token: otherToken } = await createVendor();
    const category = await createCategory();
    const sku = `MINE-${uniqueSuffix()}`;
    await upload(VENDOR_BASE, token, [`Mine,${sku},${category.name},,300,,4,0.4,,${IMG},,,,`]);
    const product = await Product.findOne({ sku });

    const stolen = await request(app)
      .post(`${VENDOR_BASE}/approve-products`)
      .set(auth(otherToken))
      .send({ productIds: [String(product._id)] });
    expect(stolen.status).toBe(400);
    expect((await Product.findById(product._id)).importPreview).toBe(true);

    const edit = await request(app)
      .put(`/vendor/products/${product._id}`)
      .set(auth(token))
      .field('name', 'Mine, renamed')
      .field('status', 'Active');
    expect(edit.status).toBe(200);
    expect(await Product.findById(product._id).lean()).toMatchObject({
      name: 'Mine, renamed',
      importPreview: true,
      status: 'Draft',
      isActive: false,
    });
  });

  it('skips SKUs already in the catalog instead of updating them', async () => {
    const { vendor, token } = await createVendor();
    const category = await createCategory();
    const sku = `EXIST-${uniqueSuffix()}`;
    const existing = await Product.create({
      name: 'Old Name',
      sku,
      category: category._id,
      vendor: vendor._id,
      price: 100,
      stock: 1,
      weight: 0.2,
      approvalStatus: 'APPROVED',
    });

    // Even when update mode is asked for — preview mode only ever adds.
    const { batch, rows } = await upload(VENDOR_BASE, token, [`New Name,${sku},,,150,,9,,,,,,,`], {
      duplicateMode: 'UPDATE',
    });
    expect(rows[0]).toMatchObject({ status: 'SKIPPED' });
    expect(batch.status).toBe('FAILED');
    expect(await Product.findById(existing._id).lean()).toMatchObject({ name: 'Old Name', price: 100 });
  });

  it('deleting the last preview closes the import', async () => {
    const { token } = await createVendor();
    const category = await createCategory();
    const sku = `GONE-${uniqueSuffix()}`;
    const { batch } = await upload(VENDOR_BASE, token, [`Gone,${sku},${category.name},,300,,4,0.4,,${IMG},,,,`]);
    const product = await Product.findOne({ sku });

    const del = await request(app).delete(`/vendor/products/${product._id}`).set(auth(token));
    expect(del.status).toBe(200);
    expect((await ProductImport.findById(batch.id)).status).toBe('REJECTED');
  });
});

describe('CSV product import — admin preview mode', () => {
  it('adds valid rows to the product list as hidden Draft previews', async () => {
    const { token } = await createAdmin();
    const category = await createCategory();
    const sku = `ADM-${uniqueSuffix()}`;
    const { batch, rows } = await upload(ADMIN_BASE, token, [
      `Admin Item,${sku},${category.name},,999,,20,1,,${IMG},,,,`,
      `Broken,BRK-${uniqueSuffix()},No Such Category,,1,,1,1,,${IMG},,,,`,
    ]);
    expect(batch).toMatchObject({ status: 'PENDING_REVIEW', mode: 'PREVIEW' });
    expect(batch.counts).toMatchObject({ created: 1, invalid: 1 });
    expect(rows[1].errors[0]).toMatch(/category/i);

    const product = await Product.findOne({ sku });
    expect(product).toMatchObject({ importPreview: true, isActive: false, status: 'Draft', vendor: null });
    expect(String(product.importBatch)).toBe(batch.id);

    // Visible to the admin with its Preview flag...
    const list = await request(app).get('/admin/catalog/products').set(auth(token));
    const listed = list.body.data.items.find((p) => p.sku === sku);
    expect(listed).toMatchObject({ importPreview: true, isActive: false });

    // ...but not to buyers.
    const pub = await request(app).get(`/catalog/products/${product._id}`);
    expect(pub.status).toBe(404);
  });

  it('only approval makes a preview live — not the visibility switch or an edit', async () => {
    const { token } = await createAdmin();
    const category = await createCategory();
    const sku = `APR-${uniqueSuffix()}`;
    const { batch } = await upload(ADMIN_BASE, token, [`Approve Me,${sku},${category.name},,500,,5,1,,${IMG},,,,`]);
    const product = await Product.findOne({ sku });

    const toggle = await request(app)
      .patch(`/admin/catalog/products/${product._id}/status`)
      .set(auth(token))
      .send({ isActive: true });
    expect(toggle.status).toBe(400);
    expect(toggle.body.message).toMatch(/still a preview/);

    const edit = await request(app)
      .put(`/admin/catalog/products/${product._id}`)
      .set(auth(token))
      .field('name', 'Approve Me Fixed')
      .field('status', 'Active');
    expect(edit.status).toBe(200);
    const edited = await Product.findById(product._id);
    expect(edited).toMatchObject({ name: 'Approve Me Fixed', isActive: false, importPreview: true });

    const approve = await request(app)
      .post(`${ADMIN_BASE}/approve-products`)
      .set(auth(token))
      .send({ productIds: [String(product._id)] });
    expect(approve.status).toBe(200);
    expect(approve.body.data.approved).toBe(1);

    const live = await Product.findById(product._id);
    expect(live).toMatchObject({ importPreview: false, isActive: true, status: 'Active' });
    expect((await request(app).get(`/catalog/products/${product._id}`)).status).toBe(200);

    const closed = await request(app).get(`${ADMIN_BASE}/${batch.id}`).set(auth(token));
    expect(closed.body.data.status).toBe('APPROVED');
    expect(closed.body.data.counts.approved).toBe(1);
  });

  it('deleting every preview closes the import as rejected', async () => {
    const { token } = await createAdmin();
    const category = await createCategory();
    const sku = `DEL-${uniqueSuffix()}`;
    const { batch } = await upload(ADMIN_BASE, token, [`Delete Me,${sku},${category.name},,500,,5,1,,${IMG},,,,`]);
    const product = await Product.findOne({ sku });

    const del = await request(app).delete(`/admin/catalog/products/${product._id}`).set(auth(token));
    expect(del.status).toBe(200);
    const closed = await request(app).get(`${ADMIN_BASE}/${batch.id}`).set(auth(token));
    expect(closed.body.data.status).toBe('REJECTED');
  });

  it('rejecting the import discards the previews that are still waiting', async () => {
    const { token } = await createAdmin();
    const category = await createCategory();
    const a = `RJA-${uniqueSuffix()}`;
    const b = `RJB-${uniqueSuffix()}`;
    const { batch } = await upload(ADMIN_BASE, token, [
      `Keep,${a},${category.name},,500,,5,1,,${IMG},,,,`,
      `Discard,${b},${category.name},,500,,5,1,,${IMG},,,,`,
    ]);
    const keep = await Product.findOne({ sku: a });
    await request(app).post(`${ADMIN_BASE}/approve-products`).set(auth(token)).send({ productIds: [String(keep._id)] });

    const res = await request(app).post(`${ADMIN_BASE}/${batch.id}/reject`).set(auth(token));
    expect(res.status).toBe(200);
    expect(await Product.countDocuments({ sku: b })).toBe(0);
    expect((await Product.findOne({ sku: a })).isActive).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('admin imports respect seller-only mode', async () => {
    const { token } = await createAdmin();
    await CatalogSettings.updateOne({ key: 'GLOBAL' }, { $set: { sellerOnlyMode: true } });
    const res = await request(app)
      .post(ADMIN_BASE)
      .set(auth(token))
      .attach('file', csv([`X,X-${uniqueSuffix()},Cat,,1,,1,1,,${IMG},,,,`]), 'p.csv');
    expect(res.status).toBe(403);
    expect(await ProductImport.countDocuments({ ownerType: 'ADMIN', status: 'PROCESSING' })).toBe(0);
  });
});

describe('remote image fetch guard', () => {
  it('refuses private, loopback, metadata and mapped addresses', () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.4', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    for (const ip of ['8.8.8.8', '151.101.1.69', '2606:4700::1111']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });

  it('refuses non-web URLs before connecting', () => {
    const { assertFetchable } = jest.requireActual('../services/productImport/remoteImage');
    expect(() => assertFetchable('file:///etc/passwd')).toThrow(/http and https/);
    expect(() => assertFetchable('http://127.0.0.1/x.jpg')).toThrow(/private/);
    expect(() => assertFetchable('http://localhost/x.jpg')).toThrow(/private/);
    expect(() => assertFetchable('https://example.com:8443/x.jpg')).toThrow(/standard web ports/);
    expect(() => assertFetchable('https://example.com/x.jpg')).not.toThrow();
  });
});
