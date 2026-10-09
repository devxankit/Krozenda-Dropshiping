// Admin sees "Accepted" for Privacy Policy and Terms against every customer and
// seller; a buyer's sign-in files the current policy versions on the account.
const request = require('supertest');
const app = require('../app');
const Customer = require('../Models/Customer');
const OtpRequest = require('../Models/OtpRequest');
const { connectTestDb, disconnectTestDb, createAdmin, createVendor } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('policy acceptance in the admin panel', () => {
  let auth;
  beforeAll(async () => {
    const { token } = await createAdmin();
    auth = { Authorization: `Bearer ${token}` };
  });

  it('lists Privacy Policy and Terms as accepted for sellers', async () => {
    const { vendor } = await createVendor();
    const res = await request(app).get('/admin/vendors').set(auth);
    const row = res.body.data.items.find((v) => v.id === vendor._id.toString());
    expect(row.policies.privacy.accepted).toBe(true);
    expect(row.policies.terms.accepted).toBe(true);
  });

  it('records the current policy versions when a buyer signs in, and lists them as accepted', async () => {
    const mobile = `9${String(Date.now()).slice(-9)}`;
    const bcrypt = require('bcryptjs');
    await OtpRequest.create({
      mobileNumber: mobile,
      otpHash: await bcrypt.hash('123456', 4),
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    const login = await request(app).post('/auth/verify-otp').send({ mobileNumber: mobile, otp: '123456' });
    expect(login.status).toBe(200);

    const customer = await Customer.findOne({ mobileNumber: mobile });
    expect(customer.policyAcceptances.map((a) => a.slug).sort()).toEqual(['privacy-policy', 'terms']);

    const res = await request(app).get('/admin/customers').set(auth);
    const row = res.body.data.items.find((c) => c.phone === mobile);
    expect(row.policies.privacy.accepted).toBe(true);
    expect(row.policies.terms.acceptedAt).toBeTruthy();
  });
});
