// Vendor onboarding emails: which lifecycle event sends which mail. The
// transport itself is mocked so nothing ever reaches an SMTP server; the
// templates are exercised separately through a fake transporter.
jest.mock('nodemailer', () => {
  const sendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
  return { createTransport: jest.fn(() => ({ sendMail })), __sendMail: sendMail };
});

const request = require('supertest');
const nodemailer = require('nodemailer');
const app = require('../app');
const Vendor = require('../Models/Vendor');
const VendorDocument = require('../Models/VendorDocument');
const emailService = require('../services/emailService');
const { connectTestDb, disconnectTestDb, createAdmin, createVendor, uniqueSuffix } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('vendor lifecycle triggers the right email', () => {
  let spies;
  let adminToken;

  beforeAll(async () => {
    ({ token: adminToken } = await createAdmin());
  });

  beforeEach(() => {
    spies = {
      received: jest.spyOn(emailService, 'sendVendorRegistrationReceived').mockResolvedValue({ sent: true }),
      approved: jest.spyOn(emailService, 'sendVendorAccountApproved').mockResolvedValue({ sent: true }),
      rejected: jest.spyOn(emailService, 'sendVendorApplicationRejected').mockResolvedValue({ sent: true }),
      docRejected: jest.spyOn(emailService, 'sendVendorDocumentRejected').mockResolvedValue({ sent: true }),
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends "registration received" when a seller signs up', async () => {
    const policies = await request(app).get('/public/cms-acceptance');
    const email = `mail${uniqueSuffix()}@test.local`;
    const res = await request(app).post('/vendor/auth/register').send({
      vendorType: 'B2C',
      name: 'Mail Signup',
      email,
      mobile: '9876543210',
      password: 'secret123',
      confirmPassword: 'secret123',
      policyAcceptances: policies.body.data.map((p) => ({ slug: p.slug, version: p.version })),
    });

    expect(res.status).toBe(201);
    expect(spies.received).toHaveBeenCalledTimes(1);
    expect(spies.received.mock.calls[0][0].email).toBe(email);
  });

  it('does not send anything when registration is refused', async () => {
    const res = await request(app).post('/vendor/auth/register').send({ vendorType: 'B2C' });
    expect(res.status).toBe(400);
    expect(spies.received).not.toHaveBeenCalled();
  });

  it('sends "registration received" again on resubmission after rejection', async () => {
    const { token } = await createVendor({ verificationStatus: 'REJECTED', isActive: false });
    const res = await request(app).post('/vendor/auth/submit-for-verification').set(auth(token));
    expect(res.status).toBe(200);
    expect(spies.received).toHaveBeenCalledTimes(1);
  });

  it('sends "account active" once on approval, not again on a repeat approve', async () => {
    const { vendor } = await createVendor({ verificationStatus: 'UNDER_REVIEW', isActive: false });

    const first = await request(app)
      .patch(`/admin/vendors/${vendor._id}/status`)
      .set(auth(adminToken))
      .send({ verificationStatus: 'APPROVED' });
    expect(first.status).toBe(200);
    expect(spies.approved).toHaveBeenCalledTimes(1);

    const again = await request(app)
      .patch(`/admin/vendors/${vendor._id}/status`)
      .set(auth(adminToken))
      .send({ verificationStatus: 'APPROVED' });
    expect(again.status).toBe(200);
    expect(spies.approved).toHaveBeenCalledTimes(1);
  });

  it('sends the rejection reason when an application is rejected', async () => {
    const { vendor } = await createVendor({ verificationStatus: 'UNDER_REVIEW', isActive: false });
    const res = await request(app)
      .patch(`/admin/vendors/${vendor._id}/status`)
      .set(auth(adminToken))
      .send({ verificationStatus: 'REJECTED', rejectionReason: '  GST certificate is blurry  ' });

    expect(res.status).toBe(200);
    expect(spies.rejected).toHaveBeenCalledTimes(1);
    expect(spies.rejected.mock.calls[0][1]).toBe('GST certificate is blurry');
    expect(spies.approved).not.toHaveBeenCalled();
  });

  it('mails the vendor when a single document is rejected, not when approved', async () => {
    const { vendor } = await createVendor({ verificationStatus: 'UNDER_REVIEW', isActive: false });
    const doc = await VendorDocument.create({
      vendorId: vendor._id,
      documentType: 'PAN_DOCUMENT',
      documentUrl: '/uploads/pan.pdf',
    });

    const ok = await request(app)
      .patch(`/admin/vendors/${vendor._id}/documents/${doc._id}`)
      .set(auth(adminToken))
      .send({ status: 'APPROVED' });
    expect(ok.status).toBe(200);
    expect(spies.docRejected).not.toHaveBeenCalled();

    const bad = await request(app)
      .patch(`/admin/vendors/${vendor._id}/documents/${doc._id}`)
      .set(auth(adminToken))
      .send({ status: 'REJECTED', rejectionReason: 'PAN number does not match' });
    expect(bad.status).toBe(200);
    expect(spies.docRejected).toHaveBeenCalledTimes(1);
    const [mailedVendor, mailedDoc] = spies.docRejected.mock.calls[0];
    expect(mailedVendor.email).toBe(vendor.email);
    expect(mailedDoc.rejectionReason).toBe('PAN number does not match');
  });

  it('sends "account active" when an admin onboards a partner with approveNow', async () => {
    const res = await request(app)
      .post('/admin/vendors')
      .set(auth(adminToken))
      .send({
        vendorType: 'B2C',
        name: 'Admin Onboarded',
        email: `onboard${uniqueSuffix()}@test.local`,
        mobile: '9876543213',
        password: 'secret123',
        approveNow: true,
      });
    expect(res.status).toBe(201);
    expect(spies.approved).toHaveBeenCalledTimes(1);
  });
});

describe('email templates', () => {
  const ENV_KEYS = ['EMAIL_ENABLED', 'ENV', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'FRONTEND_URL'];
  let saved;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    Object.assign(process.env, {
      EMAIL_ENABLED: 'true',
      ENV: 'development',
      SMTP_HOST: 'smtp.test.local',
      SMTP_USER: 'bot@test.local',
      SMTP_PASS: 'x',
      FRONTEND_URL: 'https://shop.test/',
    });
    nodemailer.__sendMail.mockClear();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('never sends while ENV=test, whatever EMAIL_ENABLED says', async () => {
    process.env.ENV = 'test';
    const result = await emailService.sendVendorAccountApproved({ name: 'A', email: 'a@test.local' });
    expect(result).toEqual({ sent: false, reason: 'disabled' });
    expect(nodemailer.__sendMail).not.toHaveBeenCalled();
  });

  it('links B2B vendors to the partner panel and B2C to the seller panel', async () => {
    await emailService.sendVendorAccountApproved({ name: 'P', email: 'p@test.local', vendorType: 'B2B' });
    await emailService.sendVendorAccountApproved({ name: 'S', email: 's@test.local', vendorType: 'B2C' });

    const [partner, seller] = nodemailer.__sendMail.mock.calls.map(([mail]) => mail);
    expect(partner.to).toBe('p@test.local');
    expect(partner.html).toContain('https://shop.test/partner/login');
    expect(seller.html).toContain('https://shop.test/seller/login');
  });

  it('escapes admin-entered text so it cannot inject HTML', async () => {
    await emailService.sendVendorDocumentRejected(
      { name: '<b>Evil</b>', email: 'e@test.local', vendorType: 'B2C' },
      { documentType: 'GST_CERTIFICATE', rejectionReason: '<script>alert(1)</script>' }
    );

    const [mail] = nodemailer.__sendMail.mock.calls[0];
    expect(mail.subject).toContain('GST CERTIFICATE');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('/seller/kyc-documents');
    expect(mail.text).toContain('<script>alert(1)</script>');
  });

  it('reports a transport failure instead of throwing', async () => {
    nodemailer.__sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await emailService.sendVendorRegistrationReceived({ name: 'A', email: 'a@test.local' });
    expect(result).toEqual({ sent: false, reason: 'error' });
    spy.mockRestore();
  });
});
