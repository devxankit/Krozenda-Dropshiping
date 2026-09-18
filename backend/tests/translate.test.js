// Google itself is mocked throughout. These tests are about the layer we own
// — validation, the cache tiers, the fallback to English — and a suite that
// makes real calls to an unofficial endpoint would be slow, flaky and
// rate-limited on CI for no added confidence.
jest.mock('google-translate-api-x', () => ({
  translate: jest.fn(),
  isSupported: jest.fn(() => true),
}));

const request = require('supertest');
const app = require('../app');
const { translate } = require('google-translate-api-x');
const Translation = require('../Models/Translation');
const { invalidate, flushPendingWrites } = require('../services/translationService');

const { connectTestDb, disconnectTestDb } = require('./helpers');

beforeAll(connectTestDb);
// The cache write is fire-and-forget, so without this the suite can tear the
// connection down mid-write and log a failure for work that actually succeeded.
afterAll(async () => {
  await flushPendingWrites();
  await disconnectTestDb();
});

// The in-process cache outlives an individual test by design, so it has to be
// cleared between them or the second test for a string never reaches Mongo.
beforeEach(async () => {
  jest.clearAllMocks();
  invalidate();
  await flushPendingWrites();
  await Translation.deleteMany({});
});

// Mirrors the library's real shape: one result object per input string.
const asResults = (texts, fn) => texts.map((text) => ({ text: fn(text) }));

describe('GET /translate/languages', () => {
  it('serves the switcher list without a token', async () => {
    const res = await request(app).get('/translate/languages');

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('en');
    expect(res.body.data.languages.map((l) => l.code)).toEqual(expect.arrayContaining(['en', 'hi', 'ur']));
  });
});

describe('POST /translate', () => {
  it('translates and returns a map keyed by the source string', async () => {
    translate.mockResolvedValueOnce(asResults(['Privacy Policy'], () => 'गोपनीयता नीति'));

    const res = await request(app).post('/translate').send({ to: 'hi', texts: ['Privacy Policy'] });

    expect(res.status).toBe(200);
    expect(res.body.data.translations).toEqual({ 'Privacy Policy': 'गोपनीयता नीति' });
  });

  it('rejects a language that is not offered', async () => {
    const res = await request(app).post('/translate').send({ to: 'xx', texts: ['Back'] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_LANGUAGE');
    expect(translate).not.toHaveBeenCalled();
  });

  it('rejects anything that is not an array of texts', async () => {
    const res = await request(app).post('/translate').send({ to: 'hi', texts: 'Back' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TEXTS');
  });

  it('caps the batch size rather than forwarding an unbounded array', async () => {
    const texts = Array.from({ length: 201 }, (_, i) => `String ${i}`);

    const res = await request(app).post('/translate').send({ to: 'hi', texts });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOO_MANY_TEXTS');
    expect(translate).not.toHaveBeenCalled();
  });

  it('answers a request for the source language without calling out', async () => {
    const res = await request(app).post('/translate').send({ to: 'en', texts: ['Privacy Policy'] });

    expect(res.status).toBe(200);
    expect(res.body.data.translations).toEqual({ 'Privacy Policy': 'Privacy Policy' });
    expect(translate).not.toHaveBeenCalled();
  });

  it('skips strings with nothing to translate', async () => {
    const res = await request(app).post('/translate').send({ to: 'hi', texts: ['', '1,299', '—'] });

    expect(res.status).toBe(200);
    expect(res.body.data.translations).toEqual({ '': '', '1,299': '1,299', '—': '—' });
    expect(translate).not.toHaveBeenCalled();
  });

  it('sends each distinct string once, however many times it is repeated', async () => {
    translate.mockImplementationOnce(async (texts) => asResults(texts, (t) => `hi:${t}`));

    const res = await request(app)
      .post('/translate')
      .send({ to: 'hi', texts: ['Back', 'Back', 'Cart', 'Back'] });

    expect(res.status).toBe(200);
    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0]).toEqual(['Back', 'Cart']);
    expect(res.body.data.translations).toEqual({ Back: 'hi:Back', Cart: 'hi:Cart' });
  });

  it('writes what it fetched to the translation memory', async () => {
    translate.mockImplementationOnce(async (texts) => asResults(texts, (t) => `hi:${t}`));

    await request(app).post('/translate').send({ to: 'hi', texts: ['Wishlist'] });

    const row = await Translation.findOne({ lang: 'hi', source: 'Wishlist' }).lean();
    expect(row).toMatchObject({ lang: 'hi', source: 'Wishlist', text: 'hi:Wishlist' });
  });

  it('serves a second request from the translation memory instead of calling out again', async () => {
    translate.mockImplementationOnce(async (texts) => asResults(texts, (t) => `hi:${t}`));

    await request(app).post('/translate').send({ to: 'hi', texts: ['Wishlist'] });
    // Drop the in-process tier so the second request has to reach Mongo —
    // otherwise this would pass even with no persistence at all.
    invalidate();

    const second = await request(app).post('/translate').send({ to: 'hi', texts: ['Wishlist'] });

    expect(second.body.data.translations).toEqual({ Wishlist: 'hi:Wishlist' });
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it('never overwrites a translation a human has corrected', async () => {
    translate.mockImplementation(async (texts) => asResults(texts, () => 'machine'));
    await request(app).post('/translate').send({ to: 'hi', texts: ['Wishlist'] });

    await Translation.updateOne({ lang: 'hi', source: 'Wishlist' }, { text: 'reviewed', reviewed: true });
    invalidate();

    const res = await request(app).post('/translate').send({ to: 'hi', texts: ['Wishlist'] });

    expect(res.body.data.translations.Wishlist).toBe('reviewed');
    expect((await Translation.findOne({ lang: 'hi', source: 'Wishlist' }).lean()).text).toBe('reviewed');
  });

  it('falls back to English when the upstream call fails', async () => {
    translate.mockRejectedValueOnce(new Error('429 Too Many Requests'));

    const res = await request(app).post('/translate').send({ to: 'hi', texts: ['Privacy Policy'] });

    expect(res.status).toBe(200);
    expect(res.body.data.translations).toEqual({ 'Privacy Policy': 'Privacy Policy' });
    // A string we could not translate must not be cached as if it were fine,
    // or it would never be retried.
    expect(await Translation.countDocuments({ lang: 'hi' })).toBe(0);
  });

  it('splits a batch larger than the upstream chunk size', async () => {
    translate.mockImplementation(async (texts) => asResults(texts, (t) => `hi:${t}`));
    const texts = Array.from({ length: 95 }, (_, i) => `String ${i}`);

    const res = await request(app).post('/translate').send({ to: 'hi', texts });

    // 95 strings at 40 per chunk.
    expect(translate).toHaveBeenCalledTimes(3);
    expect(Object.keys(res.body.data.translations)).toHaveLength(95);
    expect(res.body.data.translations['String 94']).toBe('hi:String 94');
  });
});
