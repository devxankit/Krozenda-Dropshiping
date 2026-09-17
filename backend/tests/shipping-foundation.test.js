// Phase 3a — the shipping foundation, before any carrier call is wired up.
//
// These cover the three things that would be most expensive to get wrong and
// hardest to notice later: credential handling, account routing (Seller A's
// parcel must never reach Seller B's carrier account), and the status machine
// that webhooks drive.
const crypto = require('crypto');

const ShippingIntegration = require('../Models/ShippingIntegration');
const ShippingSettings = require('../Models/ShippingSettings');
const PickupLocation = require('../Models/PickupLocation');
const Shipment = require('../Models/Shipment');
const TrackingEvent = require('../Models/TrackingEvent');

const secretBox = require('../utils/secretBox');
const packaging = require('../utils/packaging');
const { canTransitionTo, mapShiprocketStatus, BUYER_FACING_ORDER_STATUS } = require('../Config/shipping');
const resolver = require('../services/shipping/shippingAccountResolver');
const authService = require('../services/shipping/shiprocketAuthService');

const { connectTestDb, disconnectTestDb, createVendor, createCustomer, createProduct } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

// A real 32-byte key for the encryption tests. Generated per run, never a
// fixture value that could be mistaken for a production key.
const TEST_KEY = crypto.randomBytes(32).toString('hex');

async function resetShipping() {
  await Promise.all([
    ShippingIntegration.deleteMany({}),
    ShippingSettings.deleteMany({}),
    PickupLocation.deleteMany({}),
    Shipment.deleteMany({}),
    TrackingEvent.deleteMany({}),
  ]);
}

async function setSettings(patch) {
  const settings = await ShippingSettings.getSettings();
  Object.assign(settings, patch);
  await settings.save();
  return settings;
}

// ---------------------------------------------------------------------------
// Credential encryption
// ---------------------------------------------------------------------------
describe('credential encryption at rest', () => {
  const originalKey = process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
  });
  afterAll(() => {
    if (originalKey === undefined) delete process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY = originalKey;
  });

  it('round-trips a password', () => {
    const secret = 'a-sellers-shiprocket-password-!@#';
    expect(secretBox.decrypt(secretBox.encrypt(secret))).toBe(secret);
  });

  it('never produces the plaintext inside the envelope', () => {
    const secret = 'PlainTextShouldNotAppear123';
    expect(secretBox.encrypt(secret)).not.toContain(secret);
  });

  it('produces a different ciphertext every time (random IV)', () => {
    const secret = 'same-password-twice';
    expect(secretBox.encrypt(secret)).not.toBe(secretBox.encrypt(secret));
  });

  it('refuses a tampered envelope instead of returning garbage', () => {
    const envelope = secretBox.encrypt('original-secret');
    const parts = envelope.split('.');
    // Flip a byte in the ciphertext.
    const data = Buffer.from(parts[3], 'base64');
    data[0] ^= 0xff;
    parts[3] = data.toString('base64');

    expect(() => secretBox.decrypt(parts.join('.'))).toThrow(/could not be decrypted/i);
  });

  it('refuses to decrypt with a different key', () => {
    const envelope = secretBox.encrypt('secret-under-key-a');
    process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    expect(() => secretBox.decrypt(envelope)).toThrow(/could not be decrypted/i);
  });

  it('fails clearly when the key is missing rather than storing plaintext', () => {
    delete process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY;
    expect(secretBox.isConfigured()).toBe(false);
    expect(() => secretBox.encrypt('anything')).toThrow(/ENCRYPTION_KEY|not set/i);
  });

  it('rejects a key of the wrong length', () => {
    process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY = 'too-short';
    expect(() => secretBox.encrypt('anything')).toThrow(/32 bytes/i);
  });

  it('compares shared secrets without leaking length through ===', () => {
    expect(secretBox.safeEqual('abc123', 'abc123')).toBe(true);
    expect(secretBox.safeEqual('abc123', 'abc124')).toBe(false);
    expect(secretBox.safeEqual('abc123', 'a')).toBe(false);
    expect(secretBox.safeEqual('', undefined)).toBe(true); // both empty
  });

  it('masks an email for logs', () => {
    const masked = secretBox.maskEmail('seller@example.com');
    // Enough to tell two accounts apart in a log, not enough to be PII.
    expect(masked.startsWith('se')).toBe(true);
    expect(masked.endsWith('@example.com')).toBe(true);
    expect(masked).not.toContain('seller');
    expect(secretBox.maskEmail('')).toBe('***');
    // A one-character local part must not round-trip in the clear.
    expect(secretBox.maskEmail('a@b.com')).not.toBe('a@b.com');
  });
});

// ---------------------------------------------------------------------------
// Integration record never leaks a secret
// ---------------------------------------------------------------------------
describe('ShippingIntegration never exposes credentials', () => {
  beforeEach(async () => {
    await resetShipping();
    process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
  });

  it('excludes the encrypted password from a normal query', async () => {
    const { vendor } = await createVendor();
    await ShippingIntegration.create({
      vendor: vendor._id,
      accountType: 'SELLER',
      provider: 'SHIPROCKET',
      status: 'CONNECTED',
      credentials: { email: 'seller@example.com', encryptedPassword: secretBox.encrypt('hunter2') },
    });

    const fetched = await ShippingIntegration.findOne({ vendor: vendor._id });
    expect(fetched.credentials.email).toBe('seller@example.com');
    // select: false — absent unless explicitly requested.
    expect(fetched.credentials.encryptedPassword).toBeUndefined();

    const explicit = await ShippingIntegration.findOne({ vendor: vendor._id }).select(
      '+credentials.encryptedPassword'
    );
    expect(explicit.credentials.encryptedPassword).toBeTruthy();
  });

  it('toSafeJSON carries no secret material', async () => {
    const { vendor } = await createVendor();
    const integration = await ShippingIntegration.create({
      vendor: vendor._id,
      accountType: 'SELLER',
      provider: 'SHIPROCKET',
      status: 'CONNECTED',
      credentials: { email: 'seller@example.com', encryptedPassword: secretBox.encrypt('hunter2') },
    });

    const safe = integration.toSafeJSON();
    const serialised = JSON.stringify(safe);
    expect(serialised).not.toMatch(/hunter2/);
    expect(serialised).not.toMatch(/encryptedPassword/);
    expect(safe.status).toBe('CONNECTED');
  });

  it('allows only one ACTIVE integration per seller', async () => {
    const { vendor } = await createVendor();
    const base = { vendor: vendor._id, accountType: 'SELLER', provider: 'SHIPROCKET', isActive: true };

    await ShippingIntegration.create(base);
    await expect(ShippingIntegration.create(base)).rejects.toMatchObject({ code: 11000 });

    // A disconnected historical row may coexist — that is how a seller can
    // reconnect without losing the audit trail.
    await ShippingIntegration.updateOne({ vendor: vendor._id }, { $set: { isActive: false } });
    await expect(ShippingIntegration.create(base)).resolves.toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Account routing — the isolation guarantee
// ---------------------------------------------------------------------------
describe('shipping account resolution', () => {
  beforeEach(async () => {
    await resetShipping();
    authService.invalidateAll();
    process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
    process.env.SHIPROCKET_EMAIL = 'platform@krozenda.test';
    process.env.SHIPROCKET_PASSWORD = 'platform-secret';
  });

  async function connectSeller(vendorId) {
    return ShippingIntegration.create({
      vendor: vendorId,
      accountType: 'SELLER',
      provider: 'SHIPROCKET',
      status: 'CONNECTED',
      credentials: { email: `v${vendorId}@example.com`, encryptedPassword: secretBox.encrypt('pw') },
    });
  }

  it('blocks everything when shipping is disabled', async () => {
    await setSettings({ shippingEnabled: false });
    const { vendor } = await createVendor();

    const result = await resolver.resolveShippingIntegration({ vendorId: vendor._id });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(resolver.BLOCK_REASONS.SHIPPING_DISABLED);
  });

  it('uses the seller’s own account when connected', async () => {
    await setSettings({ shippingEnabled: true, sellerOwnAccountEnabled: true, platformFallbackEnabled: true });
    const { vendor } = await createVendor();
    const integration = await connectSeller(vendor._id);

    const result = await resolver.resolveShippingIntegration({ vendorId: vendor._id });
    expect(result.ok).toBe(true);
    expect(result.accountType).toBe('SELLER');
    expect(String(result.integrationId)).toBe(String(integration._id));
    expect(String(result.accountOwnerId)).toBe(String(vendor._id));
    expect(result.credentialsSource).toBe('ENCRYPTED_RECORD');
  });

  it('falls back to the platform account when the seller has none and fallback is ON', async () => {
    await setSettings({ shippingEnabled: true, sellerOwnAccountEnabled: true, platformFallbackEnabled: true });
    const { vendor } = await createVendor();

    const result = await resolver.resolveShippingIntegration({ vendorId: vendor._id });
    expect(result.ok).toBe(true);
    expect(result.accountType).toBe('PLATFORM');
    expect(result.accountOwnerId).toBeNull();
    expect(result.credentialsSource).toBe('ENVIRONMENT');
  });

  it('BLOCKS when the seller has none and fallback is OFF', async () => {
    await setSettings({ shippingEnabled: true, sellerOwnAccountEnabled: true, platformFallbackEnabled: false });
    const { vendor } = await createVendor();

    const result = await resolver.resolveShippingIntegration({ vendorId: vendor._id });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(resolver.BLOCK_REASONS.FALLBACK_DISABLED);
    expect(result.message).toMatch(/fallback/i);
  });

  it('distinguishes an unhealthy seller account from one that was never connected', async () => {
    await setSettings({ shippingEnabled: true, sellerOwnAccountEnabled: true, platformFallbackEnabled: false });
    const { vendor } = await createVendor();
    const integration = await connectSeller(vendor._id);
    integration.status = 'TOKEN_EXPIRED';
    await integration.save();

    const result = await resolver.resolveShippingIntegration({ vendorId: vendor._id });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(resolver.BLOCK_REASONS.SELLER_ACCOUNT_UNHEALTHY);
  });

  it('ignores a seller account when the admin has disabled seller-own accounts', async () => {
    await setSettings({ shippingEnabled: true, sellerOwnAccountEnabled: false, platformFallbackEnabled: true });
    const { vendor } = await createVendor();
    await connectSeller(vendor._id);

    const result = await resolver.resolveShippingIntegration({ vendorId: vendor._id });
    expect(result.ok).toBe(true);
    expect(result.accountType).toBe('PLATFORM');
  });

  // The isolation guarantee, stated as a test.
  it('never resolves Seller A to Seller B’s account', async () => {
    await setSettings({ shippingEnabled: true, sellerOwnAccountEnabled: true, platformFallbackEnabled: true });
    const { vendor: vendorA } = await createVendor();
    const { vendor: vendorB } = await createVendor();
    const integrationA = await connectSeller(vendorA._id);
    const integrationB = await connectSeller(vendorB._id);

    const a = await resolver.resolveShippingIntegration({ vendorId: vendorA._id });
    const b = await resolver.resolveShippingIntegration({ vendorId: vendorB._id });

    expect(String(a.integrationId)).toBe(String(integrationA._id));
    expect(String(b.integrationId)).toBe(String(integrationB._id));
    expect(String(a.integrationId)).not.toBe(String(b.integrationId));
  });

  it('will not accept another seller’s pickup location id', async () => {
    await setSettings({ shippingEnabled: true, platformFallbackEnabled: true });
    const { vendor: vendorA } = await createVendor();
    const { vendor: vendorB } = await createVendor();

    const bLocation = await PickupLocation.create({
      vendor: vendorB._id,
      nickname: 'B Warehouse',
      contactName: 'B',
      phone: '9999999999',
      addressLine1: 'L1',
      city: 'C',
      state: 'S',
      pincode: '452001',
    });

    // Seller A asks for Seller B's location: it must not resolve.
    const result = await resolver.resolveShippingIntegration({
      vendorId: vendorA._id,
      pickupLocationId: bLocation._id,
    });
    expect(result.pickupLocation).toBeFalsy();
  });

  it('blocks when a pickup location is required but none exists', async () => {
    await setSettings({ shippingEnabled: true, platformFallbackEnabled: true });
    const { vendor } = await createVendor();

    const result = await resolver.resolveShippingIntegration({
      vendorId: vendor._id,
      requirePickupLocation: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(resolver.BLOCK_REASONS.NO_PICKUP_LOCATION);
  });

  it('resolves an existing shipment through its stored snapshot, not current settings', async () => {
    await setSettings({ shippingEnabled: true, sellerOwnAccountEnabled: true, platformFallbackEnabled: true });
    const { vendor } = await createVendor();
    const { user: customer } = await createCustomer();
    const product = await createProduct();
    const integration = await connectSeller(vendor._id);

    const shipment = await Shipment.create({
      order: product._id, // any ObjectId; this test only exercises the snapshot
      vendor: vendor._id,
      customer: customer._id,
      items: [{ product: product._id, name: product.name, quantity: 1, unitPrice: 100 }],
      paymentMethod: 'PREPAID',
      account: {
        provider: 'SHIPROCKET',
        integration: integration._id,
        accountType: 'SELLER',
        accountOwner: vendor._id,
      },
    });

    // The seller now disconnects entirely.
    integration.isActive = false;
    integration.status = 'DISCONNECTED';
    await integration.save();

    // Tracking an already-shipped parcel must still resolve to the account
    // that created it — otherwise the buyer's tracking page breaks because
    // their seller changed providers.
    const result = await resolver.resolveForShipment(shipment, { operation: 'TRACK' });
    expect(result.ok).toBe(true);
    expect(String(result.integrationId)).toBe(String(integration._id));
    expect(result.accountType).toBe('SELLER');
  });
});

// ---------------------------------------------------------------------------
// Status machine — what webhooks will drive
// ---------------------------------------------------------------------------
describe('shipment status transitions', () => {
  it('allows forward movement', () => {
    expect(canTransitionTo('AWB_ASSIGNED', 'PICKED_UP')).toBe(true);
    expect(canTransitionTo('IN_TRANSIT', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(canTransitionTo('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
  });

  // Task §49, the specific scenario named in the brief.
  it('refuses a late IN_TRANSIT after DELIVERED', () => {
    expect(canTransitionTo('DELIVERED', 'IN_TRANSIT')).toBe(false);
  });

  it('refuses any movement out of a terminal state', () => {
    for (const terminal of ['DELIVERED', 'CANCELLED', 'RTO_DELIVERED', 'RETURN_DELIVERED', 'FAILED']) {
      expect(canTransitionTo(terminal, 'IN_TRANSIT')).toBe(false);
    }
  });

  it('treats a repeat of the current status as a no-op (duplicate webhook)', () => {
    expect(canTransitionTo('IN_TRANSIT', 'IN_TRANSIT')).toBe(false);
  });

  it('lets an exception branch interrupt a live shipment', () => {
    expect(canTransitionTo('IN_TRANSIT', 'NDR')).toBe(true);
    expect(canTransitionTo('OUT_FOR_DELIVERY', 'RTO_INITIATED')).toBe(true);
    expect(canTransitionTo('PICKED_UP', 'CANCELLED')).toBe(true);
  });

  it('applyStatus records history and stamps the lifecycle date', async () => {
    const shipment = new Shipment({
      order: new (require('mongoose').Types.ObjectId)(),
      customer: new (require('mongoose').Types.ObjectId)(),
      items: [{ product: new (require('mongoose').Types.ObjectId)(), name: 'X', quantity: 1, unitPrice: 10 }],
      paymentMethod: 'PREPAID',
      internalStatus: 'OUT_FOR_DELIVERY',
    });

    expect(shipment.applyStatus('DELIVERED', { source: 'WEBHOOK' })).toBe(true);
    expect(shipment.internalStatus).toBe('DELIVERED');
    expect(shipment.deliveredAt).toBeInstanceOf(Date);
    expect(shipment.statusHistory.at(-1)).toMatchObject({ status: 'DELIVERED', source: 'WEBHOOK' });

    // A replayed webhook changes nothing.
    expect(shipment.applyStatus('IN_TRANSIT', { source: 'WEBHOOK' })).toBe(false);
    expect(shipment.internalStatus).toBe('DELIVERED');
  });
});

describe('carrier status mapping', () => {
  it('maps known Shiprocket statuses case- and space-insensitively', () => {
    expect(mapShiprocketStatus('DELIVERED')).toBe('DELIVERED');
    expect(mapShiprocketStatus('  out   for delivery ')).toBe('OUT_FOR_DELIVERY');
    expect(mapShiprocketStatus('RTO Initiated')).toBe('RTO_INITIATED');
    expect(mapShiprocketStatus('Undelivered')).toBe('NDR');
  });

  // The important one: an unknown status must not be guessed at, and must not
  // become FAILED — it returns null so the caller leaves the shipment alone.
  it('returns null for an unknown status rather than guessing', () => {
    expect(mapShiprocketStatus('Some Brand New Status')).toBeNull();
    expect(mapShiprocketStatus('')).toBeNull();
    expect(mapShiprocketStatus(null)).toBeNull();
  });

  it('collapses every internal status to a buyer-facing order status', () => {
    const { SHIPMENT_STATUSES } = require('../Config/shipping');
    for (const status of SHIPMENT_STATUSES) {
      expect(BUYER_FACING_ORDER_STATUS[status]).toBeDefined();
      expect(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).toContain(
        BUYER_FACING_ORDER_STATUS[status]
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Tracking event deduplication
// ---------------------------------------------------------------------------
describe('tracking event deduplication', () => {
  beforeEach(resetShipping);

  it('records a scan once, however many times it arrives', async () => {
    const shipmentId = new (require('mongoose').Types.ObjectId)();
    const occurredAt = new Date('2026-09-17T10:00:00Z');
    const dedupeKey = TrackingEvent.buildDedupeKey({
      shipmentId,
      carrierStatus: 'In Transit',
      occurredAt,
    });

    const first = await TrackingEvent.record({
      shipment: shipmentId,
      carrierStatus: 'In Transit',
      occurredAt,
      dedupeKey,
    });
    const replay = await TrackingEvent.record({
      shipment: shipmentId,
      carrierStatus: 'In Transit',
      occurredAt,
      dedupeKey,
    });

    expect(first).toBeTruthy();
    expect(replay).toBeNull(); // already recorded, not an error
    expect(await TrackingEvent.countDocuments({ shipment: shipmentId })).toBe(1);
  });

  it('gives the webhook and the poller the same key for the same scan', () => {
    const shipmentId = new (require('mongoose').Types.ObjectId)();
    const occurredAt = new Date('2026-09-17T10:00:00Z');
    const fromWebhook = TrackingEvent.buildDedupeKey({ shipmentId, carrierStatus: 'Delivered', occurredAt });
    const fromPoll = TrackingEvent.buildDedupeKey({ shipmentId, carrierStatus: 'delivered', occurredAt });
    expect(fromWebhook).toBe(fromPoll);
  });

  it('prefers the carrier’s own event id when there is one', () => {
    const shipmentId = new (require('mongoose').Types.ObjectId)();
    const key = TrackingEvent.buildDedupeKey({ shipmentId, carrierEventId: 'sr-evt-99', carrierStatus: 'X', occurredAt: new Date() });
    expect(key).toBe(`evt:${shipmentId}:sr-evt-99`);
  });
});

// ---------------------------------------------------------------------------
// Package measurement
// ---------------------------------------------------------------------------
describe('package measurement', () => {
  it('computes volumetric weight as (L x B x H) / divisor', () => {
    // 30 x 20 x 10 = 6000 cm3; / 5000 = 1.2 kg
    expect(packaging.volumetricWeightKg({ lengthCm: 30, breadthCm: 20, heightCm: 10 }, 5000)).toBe(1.2);
  });

  it('honours a non-default divisor', () => {
    expect(packaging.volumetricWeightKg({ lengthCm: 30, breadthCm: 20, heightCm: 10 }, 4000)).toBe(1.5);
  });

  it('charges on the greater of actual and volumetric', () => {
    expect(packaging.chargeableWeightKg(0.5, 1.2)).toBe(1.2); // bulky and light
    expect(packaging.chargeableWeightKg(3, 1.2)).toBe(3); // small and heavy
  });

  it('treats a partial dimension set as absent', () => {
    expect(packaging.hasDimensions({ dimensions: { lengthCm: 10, breadthCm: 10, heightCm: 10 } })).toBe(true);
    expect(packaging.hasDimensions({ dimensions: { lengthCm: 10, breadthCm: 10 } })).toBe(false);
    expect(packaging.hasDimensions({})).toBe(false);
  });

  it('falls back product -> vendor default -> platform default, and says which it used', async () => {
    await resetShipping();
    const settings = await ShippingSettings.getSettings();

    const fromProduct = await packaging.suggestPackage(
      [{ quantity: 1, product: { dimensions: { lengthCm: 20, breadthCm: 20, heightCm: 5 }, weight: 1 } }],
      { settings }
    );
    expect(fromProduct.source).toBe('PRODUCT');
    expect(fromProduct.isEstimate).toBe(false);

    const fromVendor = await packaging.suggestPackage([{ quantity: 1, product: {} }], {
      settings,
      vendorDefault: { lengthCm: 25, breadthCm: 25, heightCm: 25, weightKg: 2 },
    });
    expect(fromVendor.source).toBe('VENDOR_DEFAULT');
    expect(fromVendor.isEstimate).toBe(true);

    const fromPlatform = await packaging.suggestPackage([{ quantity: 1, product: {} }], { settings });
    expect(fromPlatform.source).toBe('PLATFORM_DEFAULT');
    expect(fromPlatform.isEstimate).toBe(true);
  });

  it('recomputes weights from the seller’s confirmed figures, not the client’s', () => {
    const snapshot = packaging.buildPackageSnapshot(
      // A client claiming an absurdly low chargeable weight has no effect:
      // only L/B/H/actual are read, everything else is derived.
      { lengthCm: 30, breadthCm: 20, heightCm: 10, actualWeightKg: 0.4, chargeableWeightKg: 0.01 },
      5000
    );
    expect(snapshot.volumetricWeightKg).toBe(1.2);
    expect(snapshot.chargeableWeightKg).toBe(1.2);
  });

  it('rejects measurements that look like a unit mix-up', () => {
    expect(packaging.validatePackage({ lengthCm: 30, breadthCm: 20, heightCm: 10, actualWeightKg: 1 })).toEqual([]);
    // 300 "cm" of height is more likely millimetres typed into a cm field.
    expect(packaging.validatePackage({ lengthCm: 3000, breadthCm: 20, heightCm: 10, actualWeightKg: 1 }).length).toBe(1);
    expect(packaging.validatePackage({ lengthCm: 30, breadthCm: 20, heightCm: 10, actualWeightKg: 0 }).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Shipment grouping — Decision A
// ---------------------------------------------------------------------------
describe('shipment grouping key (order, vendor, pickupLocation)', () => {
  beforeEach(resetShipping);

  async function makeShipment(orderId, vendorId, pickupLocationId, overrides = {}) {
    const mongoose = require('mongoose');
    return Shipment.create({
      order: orderId,
      vendor: vendorId,
      pickupLocation: pickupLocationId,
      customer: new mongoose.Types.ObjectId(),
      items: [{ product: new mongoose.Types.ObjectId(), name: 'X', quantity: 1, unitPrice: 10 }],
      paymentMethod: 'PREPAID',
      ...overrides,
    });
  }

  it('refuses a second FORWARD shipment for the same order+vendor+pickup', async () => {
    const mongoose = require('mongoose');
    const orderId = new mongoose.Types.ObjectId();
    const vendorId = new mongoose.Types.ObjectId();
    const pickupId = new mongoose.Types.ObjectId();

    await makeShipment(orderId, vendorId, pickupId);
    await expect(makeShipment(orderId, vendorId, pickupId)).rejects.toMatchObject({ code: 11000 });
  });

  it('allows one shipment per vendor on a multi-vendor order', async () => {
    const mongoose = require('mongoose');
    const orderId = new mongoose.Types.ObjectId();

    await makeShipment(orderId, new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId());
    await makeShipment(orderId, new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId());

    expect(await Shipment.countDocuments({ order: orderId })).toBe(2);
  });

  // The nuance called out in the brief: same seller, same order, two warehouses.
  it('allows two shipments for one vendor shipping from two warehouses', async () => {
    const mongoose = require('mongoose');
    const orderId = new mongoose.Types.ObjectId();
    const vendorId = new mongoose.Types.ObjectId();

    await makeShipment(orderId, vendorId, new mongoose.Types.ObjectId());
    await makeShipment(orderId, vendorId, new mongoose.Types.ObjectId());

    expect(await Shipment.countDocuments({ order: orderId, vendor: vendorId })).toBe(2);
  });

  it('allows a RETURN shipment alongside its forward shipment', async () => {
    const mongoose = require('mongoose');
    const orderId = new mongoose.Types.ObjectId();
    const vendorId = new mongoose.Types.ObjectId();
    const pickupId = new mongoose.Types.ObjectId();

    const forward = await makeShipment(orderId, vendorId, pickupId, { awbCode: 'FWD-123' });
    const ret = await makeShipment(orderId, vendorId, pickupId, {
      shipmentType: 'RETURN',
      parentShipment: forward._id,
      awbCode: 'RET-456',
    });

    // The forward AWB is untouched — task §22.
    const reloaded = await Shipment.findById(forward._id);
    expect(reloaded.awbCode).toBe('FWD-123');
    expect(ret.awbCode).toBe('RET-456');
  });
});

// ---------------------------------------------------------------------------
// Pickup locations
// ---------------------------------------------------------------------------
describe('pickup locations', () => {
  beforeEach(resetShipping);

  it('keeps nicknames unique per seller but not across sellers', async () => {
    const { vendor: a } = await createVendor();
    const { vendor: b } = await createVendor();
    const base = {
      nickname: 'Indore Warehouse',
      contactName: 'Ops',
      phone: '9999999999',
      addressLine1: 'L1',
      city: 'Indore',
      state: 'MP',
      pincode: '452001',
    };

    await PickupLocation.create({ ...base, vendor: a._id });
    await expect(PickupLocation.create({ ...base, vendor: a._id })).rejects.toMatchObject({ code: 11000 });
    // A different seller may use the same label.
    await expect(PickupLocation.create({ ...base, vendor: b._id })).resolves.toBeTruthy();
  });

  it('keeps at most one default per seller', async () => {
    const { vendor } = await createVendor();
    const base = {
      vendor: vendor._id,
      contactName: 'Ops',
      phone: '9999999999',
      addressLine1: 'L1',
      city: 'Indore',
      state: 'MP',
      pincode: '452001',
    };

    const first = await PickupLocation.create({ ...base, nickname: 'W1', isDefault: true });
    await PickupLocation.create({ ...base, nickname: 'W2', isDefault: true });

    const reloaded = await PickupLocation.findById(first._id);
    expect(reloaded.isDefault).toBe(false);
    expect(await PickupLocation.countDocuments({ vendor: vendor._id, isDefault: true })).toBe(1);
  });
});
