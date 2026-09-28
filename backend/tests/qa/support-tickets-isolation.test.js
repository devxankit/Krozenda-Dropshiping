// QA audit — support ticket isolation.
//
// /user/tickets runs under optionalUserAuth so guests can raise tickets.
// Seller→admin tickets are stored with user: null, exactly like guest
// tickets, so anything a guest can reach, a seller's private ticket can
// be reached through too.

const Ticket = require('../../Models/Ticket');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createVendor,
  as,
  knownBug,
} = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const ctx = {};

beforeAll(async () => {
  ctx.buyerA = await createCustomer({ name: 'Buyer A', email: 'buyer.a@test.local' });
  ctx.buyerB = await createCustomer({ name: 'Buyer B' });
  ctx.seller = await createVendor({ verificationStatus: 'APPROVED', name: 'Seller One' });

  const a = await as(ctx.buyerA.token).post('/user/tickets', { subject: 'Buyer A private', message: 'my address is 1 Secret Lane' });
  expect(a.status).toBe(201);
  ctx.buyerTicket = a.body.data.ticketId;

  const g = await as(null).post('/user/tickets', {
    subject: 'Guest question',
    message: 'please call me',
    name: 'Guest Person',
    email: 'guest.person@test.local',
    phone: '9000000001',
  });
  expect(g.status).toBe(201);
  ctx.guestTicket = g.body.data.ticketId;

  const v = await as(ctx.seller.token).post('/vendor/tickets', {
    subject: 'Payout dispute',
    message: 'my settlement for bank a/c 1234 is short by 40,000',
  });
  expect(v.status).toBe(201);
  ctx.vendorTicket = v.body.data.ticketId;
});

describe('buyer-to-buyer isolation (works)', () => {
  test('buyer B cannot read buyer A’s ticket', async () => {
    const res = await as(ctx.buyerB.token).get(`/user/tickets/${ctx.buyerTicket}`);
    expect(res.status).toBe(403);
  });

  test('buyer B’s list never contains buyer A’s ticket, even with a wildcard search', async () => {
    const res = await as(ctx.buyerB.token).get('/user/tickets?search=.');
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((t) => t.ticketId)).not.toContain(ctx.buyerTicket);
  });

  test('a guest with no ids gets an empty list', async () => {
    const res = await as(null).get('/user/tickets');
    expect(res.body.data.items).toEqual([]);
  });
});

describe('guest / seller ticket exposure', () => {
  knownBug('QA-002a', 'an anonymous caller must not list every guest and seller ticket via ?ids=<junk>&search=.', async () => {
    const res = await as(null).get('/user/tickets?ids=TKT-000000000&search=.');
    const ids = (res.body.data?.items || []).map((t) => t.ticketId);
    expect(ids).not.toContain(ctx.guestTicket);
    expect(ids).not.toContain(ctx.vendorTicket);
  });

  knownBug('QA-002b', 'an anonymous caller must not read a seller→admin ticket by its id', async () => {
    const res = await as(null).get(`/user/tickets/${ctx.vendorTicket}`);
    expect([401, 403, 404]).toContain(res.status);
  });

  knownBug('QA-002c', 'a buyer must not be able to post into a seller→admin ticket', async () => {
    const res = await as(ctx.buyerB.token).post(`/user/tickets/${ctx.vendorTicket}/messages`, { message: 'injected' });
    expect([401, 403, 404]).toContain(res.status);
  });

  knownBug('QA-002d', 'an anonymous caller must not close a seller→admin ticket', async () => {
    const res = await as(null).patch(`/user/tickets/${ctx.vendorTicket}/status`, { status: 'closed' });
    const fresh = await Ticket.findOne({ ticketId: ctx.vendorTicket });
    expect(fresh.status).not.toBe('closed');
    expect([401, 403, 404]).toContain(res.status);
  });

  knownBug('QA-002e', 'guest status counts must not reveal platform-wide ticket totals', async () => {
    const res = await as(null).get(`/user/tickets?ids=${ctx.guestTicket}`);
    expect(res.body.data.counts.all).toBeLessThanOrEqual(1);
  });

  knownBug('QA-021', 'an invalid regex in ?search= must be a 400, not a 500', async () => {
    const res = await as(ctx.buyerA.token).get('/user/tickets?search=(');
    expect(res.status).toBe(400);
  });
});
