// Food sellers and FSSAI (utils/fssai.js): a seller who says they sell food
// must upload an FSSAI licence at sign-up; one who says no can still propose
// a food category later, but admin cannot approve it until the seller's
// licence is uploaded and approved.
const request = require('supertest');
const app = require('../app');
const Category = require('../Models/Category');
const CatalogSettings = require('../Models/CatalogSettings');
const VendorDocument = require('../Models/VendorDocument');
const Vendor = require('../Models/Vendor');
const { looksLikeFood } = require('../utils/fssai');
const { connectTestDb, disconnectTestDb, createAdmin, createVendor } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

async function acceptAllPolicies() {
  const res = await request(app).get('/public/cms-acceptance');
  return res.body.data.map((p) => ({ slug: p.slug, version: p.version }));
}

function registration(overrides = {}) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    vendorType: 'B2C',
    name: 'Food Seller',
    email: `food${suffix}@test.local`,
    mobile: '9876543210',
    password: 'secret123',
    confirmPassword: 'secret123',
    business: { businessName: 'Food Store' },
    ...overrides,
  };
}

describe('food detection', () => {
  it('flags food names and leaves look-alikes alone', () => {
    expect(looksLikeFood('Organic Snacks')).toBe(true);
    expect(looksLikeFood('Dry Fruits')).toBe(true);
    expect(looksLikeFood('Teak Furniture')).toBe(false);
    expect(looksLikeFood('Toilet Cleaner')).toBe(false);
  });
});

describe('registration', () => {
  it('requires an FSSAI licence when the seller sells food', async () => {
    const res = await request(app)
      .post('/vendor/auth/register')
      .send(registration({ sellsFood: true, policyAcceptances: await acceptAllPolicies() }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FSSAI_REQUIRED');
  });

  it('stores the licence as a pending document when provided', async () => {
    const res = await request(app)
      .post('/vendor/auth/register')
      .send(
        registration({
          sellsFood: true,
          policyAcceptances: await acceptAllPolicies(),
          documents: [
            { documentType: 'FSSAI_LICENSE', documentNumber: '12345678901234', documentUrl: '/uploads/kyc/fssai.pdf' },
          ],
        })
      );
    expect(res.status).toBe(201);
    expect(res.body.data.vendor.sellsFood).toBe(true);
    const doc = await VendorDocument.findOne({ vendorId: res.body.data.vendor.id, documentType: 'FSSAI_LICENSE' });
    expect(doc.status).toBe('PENDING');
  });

  it('lets a non-food seller register without one', async () => {
    const res = await request(app)
      .post('/vendor/auth/register')
      .send(registration({ sellsFood: false, policyAcceptances: await acceptAllPolicies() }));
    expect(res.status).toBe(201);
    expect(res.body.data.vendor.sellsFood).toBe(false);
  });
});

describe('food category approval', () => {
  let adminToken;

  beforeAll(async () => {
    ({ token: adminToken } = await createAdmin());
  });

  afterEach(async () => {
    const settings = await CatalogSettings.getSettings();
    settings.autoApprovalEnabled = false;
    await settings.save();
  });

  const queueItem = async (categoryId) => {
    const res = await request(app).get('/admin/catalog/approvals').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    return res.body.data.items.find((i) => i.id === `category:${categoryId}`);
  };

  it('blocks a food category until the seller licence is approved', async () => {
    const { vendor, token } = await createVendor({ verificationStatus: 'APPROVED' });

    const created = await request(app)
      .post('/vendor/catalog/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Namkeen ${Date.now()}` });
    expect(created.status).toBe(201);
    expect(created.body.data.isFood).toBe(true);
    expect(created.body.data.fssaiRequired).toBe(true);
    const categoryId = created.body.data.id;

    // Queue shows it blocked, and approving is refused.
    expect((await queueItem(categoryId)).blockedBy).toBe('FSSAI licence');
    const refused = await request(app)
      .post(`/admin/catalog/approvals/category:${categoryId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('FSSAI_NOT_APPROVED');

    const direct = await request(app)
      .patch(`/admin/catalog/categories/${categoryId}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED' });
    expect(direct.status).toBe(409);

    // Seller uploads a licence later; it shows up for admin review.
    const doc = await VendorDocument.create({
      vendorId: vendor._id,
      documentType: 'FSSAI_LICENSE',
      documentNumber: '12345678901234',
      documentUrl: '/uploads/vendors/fssai.pdf',
    });
    const kyc = await request(app).get('/admin/kyc').set('Authorization', `Bearer ${adminToken}`);
    expect(kyc.body.data.items.map((i) => i.id)).toContain(vendor._id.toString());

    const status = await request(app).get('/vendor/documents/fssai').set('Authorization', `Bearer ${token}`);
    expect(status.body.data.status).toBe('PENDING');

    // Admin approves the licence, then the category.
    const reviewed = await request(app)
      .patch(`/admin/vendors/${vendor._id}/documents/${doc._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });
    expect(reviewed.status).toBe(200);
    expect((await queueItem(categoryId)).blockedBy).toBeNull();

    const approved = await request(app)
      .post(`/admin/catalog/approvals/category:${categoryId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approved.status).toBe(200);
    expect((await Category.findById(categoryId)).approvalStatus).toBe('APPROVED');
  });

  it('never auto-approves a food category without an approved licence', async () => {
    const settings = await CatalogSettings.getSettings();
    settings.autoApprovalEnabled = true;
    await settings.save();

    const { token } = await createVendor({ verificationStatus: 'APPROVED' });
    const res = await request(app)
      .post('/vendor/catalog/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Homemade Treats ${Date.now()}`, isFood: 'true' });
    expect(res.body.data.approvalStatus).toBe('PENDING');

    const plain = await request(app)
      .post('/vendor/catalog/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Phone Stands ${Date.now()}` });
    expect(plain.body.data.approvalStatus).toBe('APPROVED');
  });

  it('uploading a licence from the profile marks the seller as a food seller', async () => {
    const { vendor, token } = await createVendor({ verificationStatus: 'APPROVED' });
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

    const noNumber = await request(app)
      .post('/vendor/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('documentType', 'FSSAI_LICENSE')
      .attach('file', pdf, { filename: 'fssai.pdf', contentType: 'application/pdf' });
    expect(noNumber.status).toBe(400);

    const uploaded = await request(app)
      .post('/vendor/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('documentType', 'FSSAI_LICENSE')
      .field('documentNumber', '12345678901234')
      .attach('file', pdf, { filename: 'fssai.pdf', contentType: 'application/pdf' });
    expect(uploaded.status).toBe(201);
    expect((await Vendor.findById(vendor._id)).sellsFood).toBe(true);

    const second = await request(app)
      .post('/vendor/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('documentType', 'FSSAI_LICENSE')
      .field('documentNumber', '12345678901234')
      .attach('file', pdf, { filename: 'fssai.pdf', contentType: 'application/pdf' });
    expect(second.status).toBe(409);
  });
});
