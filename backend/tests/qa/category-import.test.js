// Admin category import: POST /admin/catalog/categories/import.

const Category = require('../../Models/Category');
const CommissionRule = require('../../Models/CommissionRule');
const CatalogSettings = require('../../Models/CatalogSettings');
const { connectTestDb, disconnectTestDb, createAdmin, createStaff, uniqueSuffix, as } = require('./qaHelpers');

let admin;
beforeAll(async () => {
  await connectTestDb();
  ({ token: admin } = await createAdmin());
});
afterAll(disconnectTestDb);

const importRows = (token, rows, dryRun = false) =>
  as(token).post('/admin/catalog/categories/import', { rows, dryRun });

// Unique names per test, so tests never collide on "already exists".
const named = (label) => `${label} ${uniqueSuffix()}`;

test('a dry run previews every row and writes nothing', async () => {
  const fresh = named('Garden');
  const res = await importRows(admin, [{ name: fresh }, { name: '' }], true);
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({
    dryRun: true,
    summary: { create: 1, skip: 0, error: 1 },
    rows: [
      { row: 1, name: fresh, outcome: 'create' },
      { row: 2, outcome: 'error', reason: 'Name is required' },
    ],
  });
  expect(await Category.countDocuments({ name: fresh })).toBe(0);
});

test('the real run creates the rows, with flags and commission', async () => {
  const food = named('Snacks');
  const plain = named('Stationery');
  const res = await importRows(admin, [
    { name: food, isActive: 'yes', isTopCategory: 'Y', isFood: '1', commissionType: 'percentage', commissionValue: '12' },
    { name: plain, isActive: 'no' },
  ]);
  expect(res.status).toBe(201);
  expect(res.body.data.summary).toEqual({ create: 2, skip: 0, error: 0 });

  const snacks = await Category.findOne({ name: food }).lean();
  expect(snacks).toMatchObject({ isActive: true, isTopCategory: true, isFood: true, approvalStatus: 'APPROVED' });
  const rule = await CommissionRule.findOne({ scope: 'CATEGORY', category: snacks._id }).lean();
  expect(rule).toMatchObject({ type: 'PERCENTAGE', value: 12 });

  // Blank flags take the same defaults as the create form: active, not top, not food.
  const stationery = await Category.findOne({ name: plain }).lean();
  expect(stationery).toMatchObject({ isActive: false, isTopCategory: false, isFood: false });
  expect(await CommissionRule.countDocuments({ category: stationery._id })).toBe(0);
});

test('re-running a file creates nothing twice; names compare case-insensitively', async () => {
  const name = named('Kitchen');
  await importRows(admin, [{ name }]);

  const again = await importRows(admin, [{ name: name.toUpperCase() }, { name: `  ${name}  ` }]);
  expect(again.body.data.summary).toEqual({ create: 0, skip: 2, error: 0 });
  expect(again.body.data.rows[0].reason).toBe('Already exists');
  expect(await Category.countDocuments({ name: new RegExp(`^${name}$`, 'i') })).toBe(1);

  const other = named('Pets');
  const inFile = await importRows(admin, [{ name: other }, { name: other.toLowerCase() }], true);
  expect(inFile.body.data.rows.map((r) => r.outcome)).toEqual(['create', 'skip']);
  expect(inFile.body.data.rows[1].reason).toBe('Repeats an earlier row');
});

test('bad rows are reported and do not stop the good ones', async () => {
  const good = named('Toys');
  const res = await importRows(admin, [
    { name: good },
    { name: named('Bad flag'), isActive: 'maybe' },
    { name: named('Too much'), commissionType: 'PERCENTAGE', commissionValue: '500' },
    { name: 'x'.repeat(101) },
  ]);
  expect(res.status).toBe(201);
  const [ok, flag, commission, long] = res.body.data.rows;
  expect(ok.outcome).toBe('create');
  expect(flag).toMatchObject({ outcome: 'error', reason: 'Active: "maybe" is not yes or no' });
  expect(commission.outcome).toBe('error');
  expect(commission.reason).toMatch(/cannot exceed/);
  expect(long).toMatchObject({ outcome: 'error', reason: 'Name is longer than 100 characters' });
  expect(await Category.countDocuments({ name: good })).toBe(1);
});

test('a large file fits (300 rows); more than 500 is refused', async () => {
  const prefix = named('Bulk');
  const rows = Array.from({ length: 300 }, (_, i) => ({ name: `${prefix} category number ${i}`, isActive: 'yes', isTopCategory: 'no' }));
  const res = await importRows(admin, rows, true);
  expect(res.status).toBe(200);
  expect(res.body.data.summary.create).toBe(300);

  const tooMany = await importRows(admin, Array.from({ length: 501 }, (_, i) => ({ name: `n${i}` })), true);
  expect(tooMany.status).toBe(400);
  expect((await importRows(admin, [], true)).status).toBe(400);
});

test('seller-only catalog mode blocks the import like the create form', async () => {
  const settings = await CatalogSettings.getSettings();
  settings.sellerOnlyMode = true;
  await settings.save();
  try {
    const res = await importRows(admin, [{ name: named('Blocked') }]);
    expect(res.status).toBe(403);
  } finally {
    settings.sellerOnlyMode = false;
    await settings.save();
  }
});

test('who may import: the categories permission; commission needs its own', async () => {
  const { token: catalogOnly } = await createStaff(['admin.access', 'admin.catalog.categories']);
  const { token: support } = await createStaff(['admin.access', 'admin.people.support']);

  expect((await importRows(support, [{ name: named('Nope') }], true)).status).toBe(403);

  const res = await importRows(catalogOnly, [
    { name: named('Allowed') },
    { name: named('With commission'), commissionType: 'PERCENTAGE', commissionValue: '5' },
  ], true);
  expect(res.status).toBe(200);
  expect(res.body.data.rows[0].outcome).toBe('create');
  expect(res.body.data.rows[1]).toMatchObject({ outcome: 'error' });
  expect(res.body.data.rows[1].reason).toMatch(/permission to set commission/);
});
