const request = require('supertest');
const app = require('../app');
const Vendor = require('../Models/Vendor');
const Category = require('../Models/Category');
const Product = require('../Models/Product');
const CommissionRule = require('../Models/CommissionRule');
const User = require('../Models/User');
const Role = require('../Models/Role');
const AccountingConfig = require('../Models/AccountingConfig');
const { signToken } = require('../utils/jwt');
const { loadRules, resolveForLine } = require('../services/commissionResolver');
const {
  connectTestDb,
  disconnectTestDb,
  createAdmin,
  createVendor,
  createCategory,
  uniqueSuffix,
} = require('./helpers');

// "Set commission, or skip" where the admin is already working: approving a
// seller, approving a seller's category or product, creating/editing a
// category. Each writes the target's base CommissionRule — the same rule the
// engine resolves — or nothing at all when skipped.

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function createStaff(permissions) {
  const role = await Role.create({ name: `Role ${uniqueSuffix()}`, permissions, isActive: true });
  const staff = await User.create({
    name: 'Staff',
    email: `staff${uniqueSuffix()}@test.local`,
    role: 'staff',
    roleId: role._id,
    isActive: true,
  });
  return signToken('admin', { id: staff._id.toString(), role: 'staff', permissions });
}

async function pendingVendor() {
  const { vendor } = await createVendor({ verificationStatus: 'UNDER_REVIEW', isActive: false });
  return vendor;
}

async function chargeOn(product, pricePaise = 100000) {
  const config = await AccountingConfig.resolve();
  const rules = await loadRules({
    vendorIds: [product.vendor],
    categoryIds: [product.category],
    productIds: [product._id],
  });
  return resolveForLine(
    { basePaise: pricePaise, vendorId: product.vendor, categoryId: product.category, productId: product._id },
    rules,
    config
  );
}

describe('approving a seller', () => {
  it('sets the seller commission when one is given', async () => {
    const { token } = await createAdmin();
    const vendor = await pendingVendor();

    const res = await request(app)
      .patch(`/admin/vendors/${vendor._id}/status`)
      .set(auth(token))
      .send({ verificationStatus: 'APPROVED', commission: { type: 'PERCENTAGE', value: 8 } });

    expect(res.status).toBe(200);
    expect(res.body.data.commission).toEqual({ type: 'PERCENTAGE', value: 8 });
    const rule = await CommissionRule.findOne({ scope: 'SELLER', vendor: vendor._id });
    expect(rule).toMatchObject({ type: 'PERCENTAGE', value: 8, priority: 0, isActive: true });

    // The engine charges it.
    const category = await createCategory();
    const product = await Product.create({ name: 'P', category: category._id, vendor: vendor._id, price: 1000, stock: 1 });
    const charge = await chargeOn(product);
    expect(charge.amountPaise).toBe(8000);
    expect(charge.workings.ruleScope).toBe('SELLER');
  });

  it('writes no rule when skipped', async () => {
    const { token } = await createAdmin();
    const vendor = await pendingVendor();
    const res = await request(app)
      .patch(`/admin/vendors/${vendor._id}/status`)
      .set(auth(token))
      .send({ verificationStatus: 'APPROVED' });
    expect(res.status).toBe(200);
    expect(await CommissionRule.countDocuments({ vendor: vendor._id })).toBe(0);
  });

  it('refuses a bad commission without approving the seller', async () => {
    const { token } = await createAdmin();
    const vendor = await pendingVendor();
    const res = await request(app)
      .patch(`/admin/vendors/${vendor._id}/status`)
      .set(auth(token))
      .send({ verificationStatus: 'APPROVED', commission: { type: 'PERCENTAGE', value: 95 } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/platform limit/);
    expect((await Vendor.findById(vendor._id)).verificationStatus).toBe('UNDER_REVIEW');
  });

  it('a KYC reviewer without commission rights can approve, but not set a rate', async () => {
    const token = await createStaff(['admin.kyc.review']);
    const vendor = await pendingVendor();

    const withRate = await request(app)
      .patch(`/admin/vendors/${vendor._id}/status`)
      .set(auth(token))
      .send({ verificationStatus: 'APPROVED', commission: { type: 'PERCENTAGE', value: 8 } });
    expect(withRate.status).toBe(403);
    expect((await Vendor.findById(vendor._id)).verificationStatus).toBe('UNDER_REVIEW');

    const skipped = await request(app)
      .patch(`/admin/vendors/${vendor._id}/status`)
      .set(auth(token))
      .send({ verificationStatus: 'APPROVED' });
    expect(skipped.status).toBe(200);
  });
});

describe("approving a seller's category or product", () => {
  it('sets a product commission (₹ per unit) on approval', async () => {
    const { token } = await createAdmin();
    const { vendor } = await createVendor();
    const category = await createCategory();
    const product = await Product.create({
      name: `Pending ${uniqueSuffix()}`,
      category: category._id,
      vendor: vendor._id,
      price: 1000,
      stock: 1,
      isActive: false,
      approvalStatus: 'PENDING',
    });

    const res = await request(app)
      .post(`/admin/catalog/approvals/product:${product._id}/approve`)
      .set(auth(token))
      .send({ commission: { type: 'FIXED', value: 20 } });
    expect(res.status).toBe(200);

    const rule = await CommissionRule.findOne({ scope: 'PRODUCT', product: product._id });
    expect(rule).toMatchObject({ type: 'FIXED', value: 20 });
    expect((await chargeOn(product)).amountPaise).toBe(2000);
  });

  it("sets a category commission on approving a seller's category", async () => {
    const { token } = await createAdmin();
    const { vendor } = await createVendor();
    const category = await Category.create({
      name: `Proposed ${uniqueSuffix()}`,
      createdByVendor: vendor._id,
      approvalStatus: 'PENDING',
    });

    const res = await request(app)
      .post(`/admin/catalog/approvals/category:${category._id}/approve`)
      .set(auth(token))
      .send({ commission: { type: 'PERCENTAGE', value: 10 } });
    expect(res.status).toBe(200);
    expect(await CommissionRule.countDocuments({ scope: 'CATEGORY', category: category._id })).toBe(1);
  });
});

describe('creating and editing a category', () => {
  it('sets the commission from the form, shows it on the list, and edits the same rule', async () => {
    const { token } = await createAdmin();
    const name = `Created ${uniqueSuffix()}`;

    const created = await request(app)
      .post('/admin/catalog/categories')
      .set(auth(token))
      .field('name', name)
      .field('commissionType', 'PERCENTAGE')
      .field('commissionValue', '12');
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const list = await request(app).get('/admin/catalog/categories').set(auth(token));
    expect(list.body.data.items.find((c) => c.id === id).commission).toEqual({ type: 'PERCENTAGE', value: 12 });

    const edited = await request(app)
      .put(`/admin/catalog/categories/${id}`)
      .set(auth(token))
      .field('commissionType', 'PERCENTAGE')
      .field('commissionValue', '9');
    expect(edited.status).toBe(200);

    const rules = await CommissionRule.find({ scope: 'CATEGORY', category: id });
    expect(rules).toHaveLength(1);
    expect(rules[0].value).toBe(9);
  });

  it('leaves the commission alone when the edit skips it', async () => {
    const { token } = await createAdmin();
    const created = await request(app)
      .post('/admin/catalog/categories')
      .set(auth(token))
      .field('name', `Keep ${uniqueSuffix()}`)
      .field('commissionValue', '7');
    const id = created.body.data.id;

    await request(app).put(`/admin/catalog/categories/${id}`).set(auth(token)).field('name', `Renamed ${uniqueSuffix()}`);
    expect((await CommissionRule.findOne({ scope: 'CATEGORY', category: id })).value).toBe(7);
  });

  it('creates a category with no rule when skipped', async () => {
    const { token } = await createAdmin();
    const created = await request(app)
      .post('/admin/catalog/categories')
      .set(auth(token))
      .field('name', `Skipped ${uniqueSuffix()}`);
    expect(created.status).toBe(201);
    expect(await CommissionRule.countDocuments({ category: created.body.data.id })).toBe(0);
  });
});

describe('turning auto-approval on', () => {
  const SETTINGS = '/admin/catalog/approvals/settings';
  const globalBase = () =>
    CommissionRule.find({ scope: 'GLOBAL', isActive: true, startDate: null, endDate: null, priority: 0 }).lean();

  beforeEach(async () => {
    await CommissionRule.deleteMany({ scope: 'GLOBAL' });
  });

  it('sets one common commission for auto-approved items, and reports it back', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .put(SETTINGS)
      .set(auth(token))
      .send({ autoApprovalEnabled: true, commission: { type: 'PERCENTAGE', value: 9 } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ autoApprovalEnabled: true, commonCommission: { type: 'PERCENTAGE', value: 9 } });

    // Turning it on again with a new rate edits the same rule.
    await request(app).put(SETTINGS).set(auth(token)).send({ autoApprovalEnabled: false });
    await request(app)
      .put(SETTINGS)
      .set(auth(token))
      .send({ autoApprovalEnabled: true, commission: { type: 'FIXED', value: 25 } });
    const rules = await globalBase();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ type: 'FIXED', value: 25 });

    // A seller product with no rule of its own is charged the common rate.
    const { vendor } = await createVendor();
    const category = await createCategory();
    const product = await Product.create({
      name: 'Auto', sku: `AUTO-${uniqueSuffix()}`, category: category._id, vendor: vendor._id,
      price: 1000, stock: 1, weight: 0.2, approvalStatus: 'APPROVED',
    });
    expect((await chargeOn(product)).rule.scope).toBe('GLOBAL');

    const get = await request(app).get(SETTINGS).set(auth(token));
    expect(get.body.data.commonCommission).toEqual({ type: 'FIXED', value: 25 });

    await request(app).put(SETTINGS).set(auth(token)).send({ autoApprovalEnabled: false });
  });

  it('turns on without a rule when skipped', async () => {
    const { token } = await createAdmin();
    const res = await request(app).put(SETTINGS).set(auth(token)).send({ autoApprovalEnabled: true, commission: null });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ autoApprovalEnabled: true, commonCommission: null });
    expect(await globalBase()).toHaveLength(0);
    await request(app).put(SETTINGS).set(auth(token)).send({ autoApprovalEnabled: false });
  });

  it('refuses a bad rate and leaves auto-approval off', async () => {
    const { token } = await createAdmin();
    await request(app).put(SETTINGS).set(auth(token)).send({ autoApprovalEnabled: false });

    const res = await request(app)
      .put(SETTINGS)
      .set(auth(token))
      .send({ autoApprovalEnabled: true, commission: { type: 'PERCENTAGE', value: 95 } });
    expect(res.status).toBe(400);
    const get = await request(app).get(SETTINGS).set(auth(token));
    expect(get.body.data.autoApprovalEnabled).toBe(false);
    expect(await globalBase()).toHaveLength(0);
  });
});
