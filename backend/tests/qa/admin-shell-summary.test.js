// QA-033: the admin shell (sidebar badges + tray) is real data, scoped to the
// caller's permissions. It used to exist only as frontend fixtures.

const Product = require('../../Models/Product');
const { connectTestDb, disconnectTestDb, createAdmin, createStaff, createVendor, createProduct, as } = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

test('counts what is actually pending, and the tray links to it', async () => {
  const before = (await as((await createAdmin()).token).get('/admin/shell-summary')).body.data.counts;
  const seller = await createVendor();
  await createProduct({ vendor: seller.vendor._id, approvalStatus: 'PENDING' });
  await createProduct({ vendor: seller.vendor._id, approvalStatus: 'PENDING' });
  await createVendor({ verificationStatus: 'UNDER_REVIEW', isActive: false });

  const res = await as((await createAdmin()).token).get('/admin/shell-summary');
  expect(res.status).toBe(200);
  expect(res.body.data.counts.productApprovals).toBe(before.productApprovals + 2);
  expect(res.body.data.counts.pendingKyc).toBe(before.pendingKyc + 1);
  const tray = res.body.data.notifications.map((n) => n.id);
  expect(tray).toEqual(expect.arrayContaining(['product-approvals', 'pending-kyc']));
  const approvals = res.body.data.notifications.find((n) => n.id === 'product-approvals');
  expect(approvals.to).toBe('/admin/catalog/approvals');
  expect(approvals.title).toMatch(/products? awaiting approval/);
});

test('a staff member only sees figures their role covers', async () => {
  await createProduct({ approvalStatus: 'PENDING' });
  const { token } = await createStaff(['admin.people.support']);
  const res = await as(token).get('/admin/shell-summary');
  expect(res.status).toBe(200);
  expect(res.body.data.counts).toEqual({ productApprovals: 0, openReturns: 0, pendingKyc: 0, failedPayouts: 0 });
  expect(res.body.data.notifications).toEqual([]);

  const approver = await createStaff(['admin.catalog.approve']);
  const scoped = await as(approver.token).get('/admin/shell-summary');
  expect(scoped.body.data.counts.productApprovals).toBeGreaterThan(0);
  expect(scoped.body.data.counts.failedPayouts).toBe(0);
});

test('requires an admin sign-in', async () => {
  expect((await as(null).get('/admin/shell-summary')).status).toBe(401);
});
