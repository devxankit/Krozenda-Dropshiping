// The UI language belongs to the ACCOUNT, not the device — that is the whole
// point of the field, so these tests are about where it is stored and what is
// allowed to change it, not about translation itself.
//
// All three panels share one implementation (Controllers/languageController.js)
// over three different collections, so each one is covered here: a bug in the
// wiring of any single panel would otherwise go unnoticed while the other two
// kept passing.
const request = require('supertest');
const app = require('../app');
const Customer = require('../Models/Customer');
const User = require('../Models/User');
const Vendor = require('../Models/Vendor');

const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createVendor,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('PUT /auth/language', () => {
  it('stores the choice against the account', async () => {
    const { user, token } = await createCustomer();

    const res = await request(app)
      .put('/auth/language')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'hi' });

    expect(res.status).toBe(200);
    expect(res.body.data.language).toBe('hi');
    expect((await Customer.findById(user._id).lean()).language).toBe('hi');
  });

  it('refuses a language that is not offered, and leaves the stored one alone', async () => {
    const { user, token } = await createCustomer({ language: 'hi' });

    const res = await request(app)
      .put('/auth/language')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'xx' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_LANGUAGE');
    expect((await Customer.findById(user._id).lean()).language).toBe('hi');
  });

  it('cannot be set by a signed-out caller', async () => {
    const res = await request(app).put('/auth/language').send({ language: 'hi' });

    expect(res.status).toBe(401);
  });

  it('only ever changes when it is changed — an unrelated profile write leaves it', async () => {
    const { user, token } = await createCustomer({ language: 'ta' });

    await request(app)
      .put('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Buyer' });

    const after = await Customer.findById(user._id).lean();
    expect(after.name).toBe('Renamed Buyer');
    expect(after.language).toBe('ta');
  });
});

describe('the session payload carries the language', () => {
  it('GET /auth/me reports it, so a new device picks it up on sign-in', async () => {
    const { token } = await createCustomer({ language: 'bn' });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.language).toBe('bn');
  });

  it('reports null for an account that has never chosen', async () => {
    // Null is not the same as English: the client reads it as "no choice yet"
    // and keeps whatever the visitor had picked before signing in, rather than
    // resetting them to English on their first login.
    const { token } = await createCustomer();

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.language).toBeNull();
  });
});

// Admins and staff (User), and sellers and dropshipping partners (Vendor),
// go through the same controller against their own collection.
describe.each([
  {
    panel: 'admin',
    path: '/admin/auth/language',
    mePath: '/admin/auth/me',
    Model: User,
    create: (overrides) => createAdmin(overrides).then(({ admin, token }) => ({ account: admin, token })),
    languageFromMe: (body) => body.data.admin.language,
  },
  {
    panel: 'vendor',
    path: '/vendor/auth/language',
    mePath: '/vendor/auth/me',
    Model: Vendor,
    create: (overrides) => createVendor(overrides).then(({ vendor, token }) => ({ account: vendor, token })),
    languageFromMe: (body) => body.data.vendor.language,
  },
])('PUT $path', ({ path, mePath, Model, create, languageFromMe }) => {
  it('stores the choice against the account', async () => {
    const { account, token } = await create();

    const res = await request(app).put(path).set('Authorization', `Bearer ${token}`).send({ language: 'ta' });

    expect(res.status).toBe(200);
    expect(res.body.data.language).toBe('ta');
    expect((await Model.findById(account._id).lean()).language).toBe('ta');
  });

  it('refuses a language that is not offered, and leaves the stored one alone', async () => {
    const { account, token } = await create({ language: 'hi' });

    const res = await request(app).put(path).set('Authorization', `Bearer ${token}`).send({ language: 'xx' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_LANGUAGE');
    expect((await Model.findById(account._id).lean()).language).toBe('hi');
  });

  it('cannot be set by a signed-out caller', async () => {
    const res = await request(app).put(path).send({ language: 'hi' });

    expect(res.status).toBe(401);
  });

  it('is reported back by /me, so another machine picks it up on sign-in', async () => {
    const { token } = await create({ language: 'gu' });

    const res = await request(app).get(mePath).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(languageFromMe(res.body)).toBe('gu');
  });

  it('reports null for an account that has never chosen', async () => {
    const { token } = await create();

    const res = await request(app).get(mePath).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(languageFromMe(res.body)).toBeNull();
  });
});

// A staff member changing their own panel language must not be able to reach
// into another account — the endpoint takes the id from the session, never
// from the body.
describe('the account is taken from the session, not the request', () => {
  it('ignores an id supplied in the body', async () => {
    const { admin: mine, token } = await createAdmin();
    const { admin: theirs } = await createAdmin({ language: 'bn' });

    await request(app)
      .put('/admin/auth/language')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'hi', id: theirs._id.toString(), _id: theirs._id.toString() });

    expect((await User.findById(mine._id).lean()).language).toBe('hi');
    expect((await User.findById(theirs._id).lean()).language).toBe('bn');
  });
});
