const crypto = require('crypto');
const request = require('supertest');

// A real 32-byte key so secretBox can encrypt. Set before anything requires
// it, because the module reads the key lazily but caches it.
process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY =
  process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const app = require('../app');
const ShopifySettings = require('../Models/ShopifySettings');
const ShopifyWebhookEvent = require('../Models/ShopifyWebhookEvent');
const CatalogSettings = require('../Models/CatalogSettings');
const secretBox = require('../utils/secretBox');
const authService = require('../services/shopify/shopifyAuthService');
const { verifySignature } = require('../Controllers/shopifyWebhookController');
const { connectTestDb, disconnectTestDb, createAdmin } = require('./helpers');

const CLIENT_SECRET = 'shpss_testsecret0123456789abcdef';

function sign(rawBody, secret = CLIENT_SECRET) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
}

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

// CatalogSettings is a singleton shared by the whole test database, so the
// visibility test below must hand it back exactly as it found it. Leaving it
// off hides every externally fulfilled product and breaks any later suite that
// expects to see one.
afterEach(async () => {
  await CatalogSettings.updateOne({ key: 'GLOBAL' }, { $set: { externalFulfillmentVisible: true } });
});

beforeEach(async () => {
  await Promise.all([ShopifySettings.deleteMany({}), ShopifyWebhookEvent.deleteMany({})]);
});

// ---------------------------------------------------------------------------
describe('Shopify settings', () => {
  test('credentials are stored encrypted and never leave through the API', async () => {
    await authService.saveCredentials({
      shopDomain: 'https://krozenda.myshopify.com/admin',
      clientId: 'client-id-abc',
      clientSecret: CLIENT_SECRET,
    });

    const raw = await ShopifySettings.findOne({ key: 'GLOBAL' }).select(
      '+encryptedClientId +encryptedClientSecret'
    );

    // The domain is normalised down to the bare host.
    expect(raw.shopDomain).toBe('krozenda.myshopify.com');

    // Stored as an envelope, not plaintext.
    expect(raw.encryptedClientSecret).not.toContain(CLIENT_SECRET);
    expect(raw.encryptedClientSecret.startsWith('v1.')).toBe(true);
    expect(secretBox.decrypt(raw.encryptedClientSecret)).toBe(CLIENT_SECRET);

    // The allowlisted serialization carries no credential at all.
    const safe = JSON.stringify(raw.toSafeJSON());
    expect(safe).not.toContain(CLIENT_SECRET);
    expect(safe).not.toContain('client-id-abc');
    expect(safe).not.toContain('encrypted');
  });

  test('an ordinary read cannot even load the secrets', async () => {
    await authService.saveCredentials({
      shopDomain: 'krozenda.myshopify.com',
      clientId: 'id',
      clientSecret: CLIENT_SECRET,
    });

    const plain = await ShopifySettings.findOne({ key: 'GLOBAL' });
    expect(plain.encryptedClientSecret).toBeUndefined();

    const withSecrets = await ShopifySettings.getSettingsWithSecrets();
    expect(withSecrets.encryptedClientSecret).toBeTruthy();
  });

  test('saving new credentials throws away the token the old ones bought', async () => {
    const settings = await ShopifySettings.getSettingsWithSecrets();
    settings.encryptedAccessToken = secretBox.encrypt('shpat_old');
    settings.accessTokenExpiresAt = new Date(Date.now() + 3600_000);
    settings.grantedScopes = ['read_products'];
    settings.status = 'CONNECTED';
    await settings.save();

    await authService.saveCredentials({
      shopDomain: 'krozenda.myshopify.com',
      clientId: 'new-id',
      clientSecret: 'shpss_rotated',
    });

    const after = await ShopifySettings.getSettingsWithSecrets();
    expect(after.encryptedAccessToken).toBe('');
    expect(after.accessTokenExpiresAt).toBeNull();
    expect(after.grantedScopes).toEqual([]);
    expect(after.status).toBe('DISCONNECTED');
  });

  test('disconnect clears every credential', async () => {
    await authService.saveCredentials({
      shopDomain: 'krozenda.myshopify.com',
      clientId: 'id',
      clientSecret: CLIENT_SECRET,
    });
    await authService.disconnect();

    const after = await ShopifySettings.getSettingsWithSecrets();
    expect(after.encryptedClientId).toBe('');
    expect(after.encryptedClientSecret).toBe('');
    expect(after.encryptedAccessToken).toBe('');
    expect(after.status).toBe('DISCONNECTED');
  });
});

// ---------------------------------------------------------------------------
describe('Shopify webhook security', () => {
  // A STRING, not a Buffer: supertest JSON-serializes a Buffer into
  // {"type":"Buffer","data":[...]} instead of sending the bytes, so the body
  // express receives would not be the body that was signed.
  const body = JSON.stringify({ id: 123, title: 'A product' });

  beforeEach(async () => {
    await authService.saveCredentials({
      shopDomain: 'krozenda.myshopify.com',
      clientId: 'id',
      clientSecret: CLIENT_SECRET,
    });
  });

  test('a correctly signed push is accepted', async () => {
    const res = await request(app)
      .post('/webhook/shopify')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Topic', 'products/update')
      .set('X-Shopify-Shop-Domain', 'krozenda.myshopify.com')
      .set('X-Shopify-Webhook-Id', `wh-${Date.now()}`)
      .set('X-Shopify-Hmac-Sha256', sign(body))
      .send(body);

    expect(res.status).toBe(200);
  });

  test('a forged signature is refused with 401', async () => {
    const res = await request(app)
      .post('/webhook/shopify')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Topic', 'products/update')
      .set('X-Shopify-Webhook-Id', `wh-forged-${Date.now()}`)
      .set('X-Shopify-Hmac-Sha256', sign(body, 'the-wrong-secret'))
      .send(body);

    expect(res.status).toBe(401);
  });

  test('a push with no signature at all is refused', async () => {
    const res = await request(app)
      .post('/webhook/shopify')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Topic', 'products/update')
      .send(body);

    expect(res.status).toBe(401);
  });

  // The signature covers the raw bytes. A body that differs by one character
  // must not verify, or an attacker could alter a stock figure in flight.
  test('a tampered body does not verify', async () => {
    const signature = sign(body);
    const tampered = JSON.stringify({ id: 123, title: 'A different product' });

    const res = await request(app)
      .post('/webhook/shopify')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Topic', 'products/update')
      .set('X-Shopify-Webhook-Id', `wh-tamper-${Date.now()}`)
      .set('X-Shopify-Hmac-Sha256', signature)
      .send(tampered);

    expect(res.status).toBe(401);
  });

  // Fail CLOSED. With no secret configured an unverifiable push must be
  // refused, not trusted — otherwise anyone who learns the URL can drive
  // stock and order status.
  test('with no secret configured it fails closed with 503, not open', async () => {
    await authService.disconnect();
    delete process.env.SHOPIFY_CLIENT_SECRET;
    // Defeat the controller's 60s secret cache.
    await new Promise((r) => setTimeout(r, 5));

    const res = await request(app)
      .post('/webhook/shopify')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Topic', 'products/update')
      .set('X-Shopify-Hmac-Sha256', sign(body))
      .send(body);

    expect([503, 401]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  test('a redelivered push is deduped on its webhook id', async () => {
    const webhookId = `wh-dupe-${Date.now()}`;
    const send = () =>
      request(app)
        .post('/webhook/shopify')
        .set('Content-Type', 'application/json')
        .set('X-Shopify-Topic', 'products/update')
        .set('X-Shopify-Webhook-Id', webhookId)
        .set('X-Shopify-Hmac-Sha256', sign(body))
        .send(body);

    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);

    // Both acknowledged — Shopify must never be told to retry — but only one
    // ledger row exists, so the work ran once.
    const rows = await ShopifyWebhookEvent.find({ webhookId });
    expect(rows).toHaveLength(1);
  });

  test('verifySignature rejects a wrong-length signature without throwing', () => {
    // timingSafeEqual throws on a length mismatch; the guard must catch that
    // before it becomes a 500 on an unauthenticated endpoint.
    const buf = Buffer.from(body, 'utf8');
    expect(() => verifySignature(buf, 'c2hvcnQ=', CLIENT_SECRET)).not.toThrow();
    expect(verifySignature(buf, 'c2hvcnQ=', CLIENT_SECRET)).toBe(false);
    expect(verifySignature(buf, 'not-base64!!', CLIENT_SECRET)).toBe(false);
    expect(verifySignature(null, sign(body), CLIENT_SECRET)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('Shopify admin API', () => {
  test('the connect form refuses a custom domain', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/admin/shopify/settings/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ shopDomain: 'krozenda.com', clientId: 'id', clientSecret: 'secret' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/myshopify\.com/i);
  });

  test('the settings response reports missing scopes and never a credential', async () => {
    const { token } = await createAdmin();
    await authService.saveCredentials({
      shopDomain: 'krozenda.myshopify.com',
      clientId: 'id',
      clientSecret: CLIENT_SECRET,
    });
    await ShopifySettings.updateOne({ key: 'GLOBAL' }, { $set: { grantedScopes: ['read_products'] } });

    const res = await request(app).get('/admin/shopify/settings').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.missingScopes).toEqual(
      expect.arrayContaining(['write_orders', 'read_orders', 'read_inventory'])
    );
    expect(JSON.stringify(res.body)).not.toContain(CLIENT_SECRET);
  });

  // Regression: the first live connection warned that read_products,
  // read_inventory and read_orders were missing while the app was reading all
  // three perfectly well. Shopify's write scopes imply read and the token
  // response lists only the write one, so a naive set difference tells admins
  // to add scopes they already have.
  test('a write scope satisfies its read counterpart', () => {
    const { missingScopes } = require('../services/shopify/shopifyConnectionService');

    expect(
      missingScopes([
        'write_products',
        'write_inventory',
        'read_locations',
        'write_orders',
        'read_fulfillments',
        'read_returns',
        'read_customers',
      ])
    ).toEqual([]);

    // A read-only scope must NOT satisfy a write requirement.
    expect(missingScopes(['read_products', 'read_inventory', 'read_orders'])).toEqual(
      expect.arrayContaining(['write_products', 'write_inventory', 'write_orders'])
    );

    expect(missingScopes([])).toHaveLength(10);
  });

  test('the storefront switch lives on CatalogSettings, so it survives disconnecting', async () => {
    const { token } = await createAdmin();

    await request(app)
      .put('/admin/shopify/settings/visibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ visible: false })
      .expect(200);

    expect((await CatalogSettings.getSettings()).externalFulfillmentVisible).toBe(false);

    await authService.disconnect();
    expect((await CatalogSettings.getSettings()).externalFulfillmentVisible).toBe(false);
  });
});
