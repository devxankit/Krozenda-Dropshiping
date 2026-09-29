// QA-017: socket handshake rules match the REST middlewares — refresh tokens,
// deleted/deactivated accounts and suspended sellers are refused, and a staff
// role only joins the admin-wide feed with dashboard access.

const { authenticateSocket } = require('../../Router/socketHandler');
const { connectTestDb, disconnectTestDb, createAdmin, createCustomer, createVendor, createStaff, signToken, signRefreshToken } = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const refused = (token) => expect(authenticateSocket(token)).rejects.toThrow('UNAUTHENTICATED');

test('buyer, seller and admin join their own rooms', async () => {
  const { user, token: u } = await createCustomer();
  const { vendor, token: v } = await createVendor();
  const { token: a } = await createAdmin();
  expect((await authenticateSocket(u)).rooms).toEqual([`user:${user._id}`]);
  expect((await authenticateSocket(v)).rooms).toEqual([`vendor:${vendor._id}`]);
  expect((await authenticateSocket(a)).rooms).toEqual(['admin']);
});

test('no token, garbage, or a refresh token is refused', async () => {
  const { user } = await createCustomer();
  await refused(undefined);
  await refused('garbage');
  await refused(signRefreshToken('user', { id: String(user._id) }));
});

test('deleted or deactivated accounts and suspended sellers are refused', async () => {
  await refused((await createCustomer({ isActive: false })).token);
  await refused((await createCustomer({ isDeleted: true })).token);
  await refused((await createAdmin({ isActive: false })).token);
  await refused((await createVendor({ verificationStatus: 'APPROVED', isActive: false })).token);
  // a token for an account that no longer exists
  await refused(signToken('user', { id: '000000000000000000000000' }));
});

test('staff join the admin feed only with dashboard access', async () => {
  const support = await createStaff(['admin.people.support']);
  expect((await authenticateSocket(support.token)).rooms).toEqual([]);
  const dash = await createStaff(['admin.dashboard.view']);
  expect((await authenticateSocket(dash.token)).rooms).toEqual(['admin']);
  const off = await createStaff(['admin.dashboard.view'], { roleActive: false });
  expect((await authenticateSocket(off.token)).rooms).toEqual([]);
});
