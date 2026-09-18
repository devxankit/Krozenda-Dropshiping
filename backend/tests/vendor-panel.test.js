const request = require('supertest');
const app = require('../app');
const Product = require('../Models/Product');
const Order = require('../Models/Order');
const ReturnRequest = require('../Models/ReturnRequest');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const VendorDocument = require('../Models/VendorDocument');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createVendor,
  createCategory,
  createProduct,
  uniqueSuffix,
} = require('./helpers');
const {
  checkMoq,
  requiresVariant,
  resolveLineTax,
  resolveStock,
  resolveUnitPrice,
} = require('../utils/pricing');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// ---------------------------------------------------------------------------
// Pricing resolver
// ---------------------------------------------------------------------------
// Pure, so these run without touching the database. They are the contract
// every other layer depends on: cart, checkout and the storefront all price
// through resolveUnitPrice, so a change here is a change everywhere.
describe('pricing resolver', () => {
  const variantId = '650000000000000000000aaa';
  const product = {
    price: 100,
    salePrice: 90,
    stock: 50,
    moq: 3,
    gstRate: 18,
    priceTiers: [
      { minQty: 10, price: 80 },
      { minQty: 50, price: 70 },
    ],
    variants: [{ _id: variantId, name: 'Red / L', price: 120, salePrice: null, stock: 5, isActive: true }],
  };

  it('prefers the sale price at retail quantity', () => {
    expect(resolveUnitPrice(product, { quantity: 1 })).toMatchObject({ unitPrice: 90, source: 'PRODUCT_SALE' });
  });

  it('applies the deepest quantity break the line qualifies for', () => {
    expect(resolveUnitPrice(product, { quantity: 10 }).unitPrice).toBe(80);
    expect(resolveUnitPrice(product, { quantity: 49 }).unitPrice).toBe(80);
    expect(resolveUnitPrice(product, { quantity: 50 }).unitPrice).toBe(70);
  });

  it('prices a variant from the variant, not the parent', () => {
    expect(resolveUnitPrice(product, { variantId, quantity: 1 })).toMatchObject({
      unitPrice: 120,
      source: 'VARIANT',
    });
  });

  // The rule that keeps a bulk buyer from ever being worse off for buying more.
  it('never lets a tier raise a price above the best available', () => {
    const cheapSale = { price: 100, salePrice: 50, priceTiers: [{ minQty: 10, price: 80 }] };
    expect(resolveUnitPrice(cheapSale, { quantity: 20 }).unitPrice).toBe(50);
  });

  it('draws stock from the variant when one is chosen', () => {
    expect(resolveStock(product)).toBe(50);
    expect(resolveStock(product, variantId)).toBe(5);
  });

  it('treats an unknown or inactive variant as no variant at all', () => {
    const inactive = { ...product, variants: [{ ...product.variants[0], isActive: false }] };
    expect(resolveStock(inactive, variantId)).toBe(50);
    expect(resolveUnitPrice(inactive, { variantId, quantity: 1 }).source).toBe('PRODUCT_SALE');
  });

  it('reports a shortfall against the minimum order quantity', () => {
    expect(checkMoq(product, 2)).toMatch(/minimum order quantity of 3/);
    expect(checkMoq(product, 3)).toBeNull();
    expect(checkMoq({ moq: 1 }, 1)).toBeNull();
  });

  it('knows when a product can no longer be bought without choosing', () => {
    expect(requiresVariant(product)).toBe(true);
    expect(requiresVariant({ variants: [] })).toBe(false);
  });

  // GST is inclusive in the listed price here, so tax is BACK-computed. Adding
  // it on top instead would overstate every invoice.
  it('back-computes inclusive GST rather than adding it on top', () => {
    expect(resolveLineTax({ gstRate: 18 }, 118)).toEqual({
      taxableValuePaise: 10000,
      taxPaise: 1800,
      rate: 18,
    });
  });

  it('treats an unclassified product as zero-rated, not as an error', () => {
    expect(resolveLineTax({}, 100)).toEqual({ taxableValuePaise: 10000, taxPaise: 0, rate: 0 });
  });
});

// ---------------------------------------------------------------------------
// Seller onboarding
// ---------------------------------------------------------------------------
describe('seller registration and verification', () => {
  it('registers a B2C seller as PENDING and hands back a usable token', async () => {
    const suffix = uniqueSuffix();
    const res = await request(app).post('/vendor/auth/register').send({
      vendorType: 'B2C',
      name: 'Self Signup',
      email: `signup${suffix}@test.local`,
      mobile: '9876543210',
      password: 'secret123',
      confirmPassword: 'secret123',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.vendor.verificationStatus).toBe('PENDING');
    expect(res.body.data.token).toBeTruthy();

    // The token has to work immediately — that is what lets a new seller reach
    // the status screen and upload documents instead of being stranded.
    const me = await request(app).get('/vendor/auth/me').set(auth(res.body.data.token));
    expect(me.status).toBe(200);
  });

  it('refuses a B2B registration with no business details', async () => {
    const suffix = uniqueSuffix();
    const res = await request(app).post('/vendor/auth/register').send({
      vendorType: 'B2B',
      name: 'No Business',
      email: `b2b${suffix}@test.local`,
      mobile: '9876543211',
      password: 'secret123',
      confirmPassword: 'secret123',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/business/i);
  });

  it('moves PENDING to UNDER_REVIEW on submit, and refuses a second submit', async () => {
    const { vendor, token } = await createVendor({ verificationStatus: 'PENDING', isActive: false });
    await VendorDocument.create({
      vendorId: vendor._id,
      documentType: 'PAN_DOCUMENT',
      documentUrl: '/uploads/pan.pdf',
    });

    const first = await request(app).post('/vendor/auth/submit-for-verification').set(auth(token));
    expect(first.status).toBe(200);
    expect(first.body.data.vendor.verificationStatus).toBe('UNDER_REVIEW');

    const second = await request(app).post('/vendor/auth/submit-for-verification').set(auth(token));
    expect(second.status).toBe(400);
  });

  // A brand-new seller is isActive:false by design and must still be able to
  // sign in to see where they stand. Only a DEACTIVATED approved seller is
  // locked out — see protectVendor.
  it('lets an unapproved seller in but locks out a deactivated approved one', async () => {
    const pending = await createVendor({ verificationStatus: 'PENDING', isActive: false });
    const ok = await request(app).get('/vendor/auth/me').set(auth(pending.token));
    expect(ok.status).toBe(200);

    const suspended = await createVendor({ verificationStatus: 'APPROVED', isActive: false });
    const denied = await request(app).get('/vendor/auth/me').set(auth(suspended.token));
    expect(denied.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Seller catalog: the B2B and variant fields
// ---------------------------------------------------------------------------
describe('seller product B2B fields', () => {
  it('stores HSN, GST, MOQ, quantity breaks and variants', async () => {
    const { token } = await createVendor();
    const category = await createCategory();

    const res = await request(app)
      .post('/vendor/products')
      .set(auth(token))
      .field('name', 'Bulk Cotton Tee')
      .field('category', category._id.toString())
      .field('price', '500')
      .field('stock', '100')
      .field('hsnCode', '6109')
      .field('gstRate', '5')
      .field('moq', '6')
      .field('priceTiers', JSON.stringify([{ minQty: 50, price: 420 }, { minQty: 10, price: 450 }]))
      .field('variants', JSON.stringify([{ name: 'Red / L', stock: 20, price: 520 }]));

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ hsnCode: '6109', gstRate: 5, moq: 6 });
    expect(res.body.data.variants).toHaveLength(1);
    expect(res.body.data.variantStock).toBe(20);

    // Tiers are stored ascending so the resolver can scan them in one pass.
    expect(res.body.data.priceTiers.map((t) => t.minQty)).toEqual([10, 50]);
  });

  it('refuses a GST rate that is not a real slab', async () => {
    const { token } = await createVendor();
    const category = await createCategory();

    const res = await request(app)
      .post('/vendor/products')
      .set(auth(token))
      .field('name', 'Bad Tax')
      .field('category', category._id.toString())
      .field('price', '100')
      .field('gstRate', '7');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/GST rate/i);
  });

  it('refuses two quantity breaks at the same quantity', async () => {
    const { token } = await createVendor();
    const category = await createCategory();

    const res = await request(app)
      .post('/vendor/products')
      .set(auth(token))
      .field('name', 'Ambiguous Tiers')
      .field('category', category._id.toString())
      .field('price', '100')
      .field('priceTiers', JSON.stringify([{ minQty: 10, price: 90 }, { minQty: 10, price: 80 }]));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/two quantity breaks/i);
  });
});

// ---------------------------------------------------------------------------
// Cart and checkout against variants / MOQ
// ---------------------------------------------------------------------------
describe('cart with variants and minimums', () => {
  async function variantProduct(overrides = {}) {
    const category = await createCategory();
    return Product.create({
      name: `Variant Product ${uniqueSuffix()}`,
      category: category._id,
      price: 100,
      stock: 0,
      variants: [
        { name: 'Red / L', price: 120, stock: 4 },
        { name: 'Blue / M', price: 110, stock: 2 },
      ],
      isActive: true,
      ...overrides,
    });
  }

  it('refuses to add a product with options unless one is chosen', async () => {
    const { token } = await createCustomer();
    const product = await variantProduct();

    const res = await request(app)
      .post('/user/cart/items')
      .set(auth(token))
      .send({ productId: product._id.toString(), quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/choose an option/i);
  });

  it('keeps two variants of one product as two separate lines', async () => {
    const { token } = await createCustomer();
    const product = await variantProduct();
    const [red, blue] = product.variants;

    await request(app)
      .post('/user/cart/items')
      .set(auth(token))
      .send({ productId: product._id.toString(), variantId: red._id.toString(), quantity: 1 });
    await request(app)
      .post('/user/cart/items')
      .set(auth(token))
      .send({ productId: product._id.toString(), variantId: blue._id.toString(), quantity: 1 });

    const cart = await request(app).get('/user/cart').set(auth(token));
    const lines = cart.body.data.items.filter((i) => i.id === product._id.toString());
    expect(lines).toHaveLength(2);
    // Each line is priced from its own variant, not from the parent.
    expect(lines.map((l) => l.price).sort()).toEqual([110, 120]);
  });

  it('clamps to the variant stock, not the parent stock', async () => {
    const { token } = await createCustomer();
    const product = await variantProduct();
    const blue = product.variants[1]; // stock 2

    await request(app)
      .post('/user/cart/items')
      .set(auth(token))
      .send({ productId: product._id.toString(), variantId: blue._id.toString(), quantity: 10 });

    const cart = await request(app).get('/user/cart').set(auth(token));
    const line = cart.body.data.items.find((i) => i.variantId === blue._id.toString());
    expect(line.quantity).toBe(2);
  });

  it('refuses a quantity below the minimum order quantity', async () => {
    const { token } = await createCustomer();
    const product = await createProduct({ stock: 100, moq: 5 });

    const low = await request(app)
      .post('/user/cart/items')
      .set(auth(token))
      .send({ productId: product._id.toString(), quantity: 2 });
    expect(low.status).toBe(400);
    expect(low.body.message).toMatch(/minimum order quantity of 5/);

    const ok = await request(app)
      .post('/user/cart/items')
      .set(auth(token))
      .send({ productId: product._id.toString(), quantity: 5 });
    expect(ok.status).toBe(200);
  });

  it('applies a quantity break as soon as the cart crosses it', async () => {
    const { token } = await createCustomer();
    const product = await createProduct({ stock: 100, price: 100, priceTiers: [{ minQty: 10, price: 70 }] });

    await request(app)
      .post('/user/cart/items')
      .set(auth(token))
      .send({ productId: product._id.toString(), quantity: 9 });

    let cart = await request(app).get('/user/cart').set(auth(token));
    let line = cart.body.data.items.find((i) => i.id === product._id.toString());
    expect(line.price).toBe(100);
    expect(line.nextTier).toMatchObject({ minQty: 10, addMore: 1 });

    await request(app)
      .put(`/user/cart/items/${product._id}`)
      .set(auth(token))
      .send({ quantity: 10 });

    cart = await request(app).get('/user/cart').set(auth(token));
    line = cart.body.data.items.find((i) => i.id === product._id.toString());
    expect(line.price).toBe(70);
    expect(line.appliedTier).toMatchObject({ minQty: 10 });
  });
});

// ---------------------------------------------------------------------------
// Returns: the seller recommends, admin decides
// ---------------------------------------------------------------------------
describe('seller recommendation on a return', () => {
  async function returnFor(vendorId) {
    const category = await createCategory();
    const product = await createProduct({ category, vendor: vendorId });
    const { user } = await createCustomer();
    const order = await Order.create({
      user: user._id,
      items: [{ product: product._id, name: product.name, price: 100, quantity: 1, vendor: vendorId }],
      shippingAddress: { fullName: 'B', phone: '9', line1: 'l', city: 'c', state: 's', pincode: '123456' },
      subtotal: 100,
      total: 100,
      paymentMethod: 'COD',
    });
    const req = await ReturnRequest.create({
      user: user._id,
      order: order._id,
      product: product._id,
      productName: product.name,
      requestType: 'REFUND',
      reason: 'Damaged on arrival',
    });
    return { product, req };
  }

  it('records the recommendation without touching the request status', async () => {
    const { vendor, token } = await createVendor();
    const { req } = await returnFor(vendor._id);

    const res = await request(app)
      .post(`/vendor/returns/${req._id}/recommend`)
      .set(auth(token))
      .send({ decision: 'REJECT', note: 'Seal was broken by the buyer' });

    expect(res.status).toBe(200);
    expect(res.body.data.sellerRecommendation).toMatchObject({
      decision: 'REJECT',
      note: 'Seal was broken by the buyer',
    });

    // The decision, and the money, stay with admin.
    const fresh = await ReturnRequest.findById(req._id);
    expect(fresh.status).toBe('PENDING');
  });

  it('refuses a recommendation on another seller\'s product', async () => {
    const owner = await createVendor();
    const intruder = await createVendor();
    const { req } = await returnFor(owner.vendor._id);

    const res = await request(app)
      .post(`/vendor/returns/${req._id}/recommend`)
      .set(auth(intruder.token))
      .send({ decision: 'APPROVE' });

    expect(res.status).toBe(404);
  });

  it('refuses a recommendation once admin has already decided', async () => {
    const { vendor, token } = await createVendor();
    const { req } = await returnFor(vendor._id);
    await ReturnRequest.updateOne({ _id: req._id }, { $set: { status: 'APPROVED' } });

    const res = await request(app)
      .post(`/vendor/returns/${req._id}/recommend`)
      .set(auth(token))
      .send({ decision: 'REJECT' });

    expect(res.status).toBe(409);
  });

  it('rejects a decision that is not APPROVE or REJECT', async () => {
    const { vendor, token } = await createVendor();
    const { req } = await returnFor(vendor._id);

    const res = await request(app)
      .post(`/vendor/returns/${req._id}/recommend`)
      .set(auth(token))
      .send({ decision: 'MAYBE' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Earnings, read off the settlement ledger
// ---------------------------------------------------------------------------
describe('seller earnings from the ledger', () => {
  it('reports paid, in-batch and unsettled separately', async () => {
    const { vendor, token } = await createVendor({ commissionRatePercent: 10 });
    const category = await createCategory();
    const product = await createProduct({ category, vendor: vendor._id });
    const { user } = await createCustomer();

    const address = { fullName: 'B', phone: '9', line1: 'l', city: 'c', state: 's', pincode: '123456' };
    const deliveredLine = (price) => ({
      product: product._id,
      name: product.name,
      price,
      quantity: 1,
      vendor: vendor._id,
      status: 'DELIVERED',
    });

    // Two delivered orders. The batch below claims only the second, so the
    // first is what has to show up as UNSETTLED — the distinction this whole
    // controller exists to make.
    await Order.create({
      user: user._id,
      items: [deliveredLine(1000)],
      shippingAddress: address,
      subtotal: 1000,
      total: 1000,
      paymentMethod: 'COD',
      deliveredAt: new Date(),
    });

    const batchedOrder = await Order.create({
      user: user._id,
      items: [deliveredLine(500)],
      shippingAddress: address,
      subtotal: 500,
      total: 500,
      paymentMethod: 'COD',
      deliveredAt: new Date(),
    });

    // A batch that has actually been paid, covering only `batchedOrder`.
    await Settlement.create({
      vendor: vendor._id,
      items: [
        {
          order: batchedOrder._id,
          product: product._id,
          name: product.name,
          quantity: 1,
          grossAmount: 500,
          commissionAmount: 50,
          netAmount: 450,
          deliveredAt: new Date(),
        },
      ],
      grossAmount: 500,
      commissionAmount: 50,
      netAmount: 450,
      netPayablePaise: 45000,
      grossPaise: 50000,
      commissionPaise: 5000,
      status: 'COMPLETED',
    });

    const res = await request(app).get('/vendor/earnings/summary').set(auth(token));

    expect(res.status).toBe(200);
    // The old controller hard-coded this to 0 whatever the ledger said.
    expect(res.body.data.paidAmount).toBe(45000);
    // The unbatched ₹1000 line, less 10% commission.
    expect(res.body.data.unsettledAmount).toBe(90000);
    expect(res.body.data.inBatchAmount).toBe(0);
  });

  it('serves a seller only their own payouts, with the account masked', async () => {
    const mine = await createVendor();
    const theirs = await createVendor();

    const settlement = await Settlement.create({
      vendor: mine.vendor._id,
      items: [
        {
          order: mine.vendor._id,
          product: mine.vendor._id,
          name: 'x',
          quantity: 1,
          grossAmount: 100,
          commissionAmount: 10,
          netAmount: 90,
          deliveredAt: new Date(),
        },
      ],
      grossAmount: 100,
      commissionAmount: 10,
      netAmount: 90,
      status: 'COMPLETED',
    });

    await Payout.create({
      payoutId: `PO-${uniqueSuffix()}`,
      vendor: mine.vendor._id,
      settlement: settlement._id,
      amount: 9000,
      bankAccountMasked: 'XXXX XXXX 4582',
      status: 'COMPLETED',
      idempotencyKey: `key-${uniqueSuffix()}`,
    });

    const res = await request(app).get('/vendor/earnings/payouts').set(auth(mine.token));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].bankAccountMasked).toBe('XXXX XXXX 4582');

    // The other seller sees nothing of it.
    const other = await request(app).get('/vendor/earnings/payouts').set(auth(theirs.token));
    expect(other.body.data.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Order acceptance and rejection
// ---------------------------------------------------------------------------
describe('seller accepting and rejecting order lines', () => {
  async function orderFor(vendorId, { stock = 10, quantity = 2 } = {}) {
    const category = await createCategory();
    const product = await createProduct({ category, vendor: vendorId, stock });
    const { user } = await createCustomer();
    const order = await Order.create({
      user: user._id,
      items: [
        { product: product._id, name: product.name, price: 100, quantity, vendor: vendorId, status: 'PENDING' },
      ],
      shippingAddress: { fullName: 'B', phone: '9', line1: 'l', city: 'c', state: 's', pincode: '123456' },
      subtotal: 100 * quantity,
      total: 100 * quantity,
      paymentMethod: 'COD',
    });
    return { product, order };
  }

  it('stamps acceptedAt when the seller starts processing', async () => {
    const { vendor, token } = await createVendor();
    const { product, order } = await orderFor(vendor._id);

    const res = await request(app)
      .patch(`/vendor/orders/${order._id}/items/${product._id}/status`)
      .set(auth(token))
      .send({ status: 'PROCESSING' });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].acceptedAt).toBeTruthy();
  });

  it('refuses a cancellation with no reason', async () => {
    const { vendor, token } = await createVendor();
    const { product, order } = await orderFor(vendor._id);

    const res = await request(app)
      .patch(`/vendor/orders/${order._id}/items/${product._id}/status`)
      .set(auth(token))
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  // The bug this covers: before, a seller cancelling a line left the stock
  // that was reserved at checkout decremented forever.
  it('returns the reserved stock when a line is cancelled', async () => {
    const { vendor, token } = await createVendor();
    const { product, order } = await orderFor(vendor._id, { stock: 8, quantity: 3 });

    const res = await request(app)
      .patch(`/vendor/orders/${order._id}/items/${product._id}/status`)
      .set(auth(token))
      .send({ status: 'CANCELLED', reason: 'Damaged in storage' });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].rejectionReason).toBe('Damaged in storage');

    const fresh = await Product.findById(product._id);
    expect(fresh.stock).toBe(11);
  });

  it('returns cancelled stock to the variant it was held against', async () => {
    const { vendor, token } = await createVendor();
    const category = await createCategory();
    const product = await Product.create({
      name: `Variant Order ${uniqueSuffix()}`,
      category: category._id,
      vendor: vendor._id,
      price: 100,
      stock: 0,
      variants: [{ name: 'Red / L', stock: 4 }],
      isActive: true,
    });
    const variant = product.variants[0];
    const { user } = await createCustomer();
    const order = await Order.create({
      user: user._id,
      items: [
        {
          product: product._id,
          name: product.name,
          price: 100,
          quantity: 2,
          variantId: variant._id,
          variant: variant.name,
          vendor: vendor._id,
          status: 'PENDING',
        },
      ],
      shippingAddress: { fullName: 'B', phone: '9', line1: 'l', city: 'c', state: 's', pincode: '123456' },
      subtotal: 200,
      total: 200,
      paymentMethod: 'COD',
    });

    await request(app)
      .patch(`/vendor/orders/${order._id}/items/${product._id}/status`)
      .set(auth(token))
      .send({ status: 'CANCELLED', reason: 'Out of that size' });

    const fresh = await Product.findById(product._id);
    // Credited to the variant, and the parent left alone.
    expect(fresh.variants[0].stock).toBe(6);
    expect(fresh.stock).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bulk CSV import
// ---------------------------------------------------------------------------
describe('seller bulk product import', () => {
  const HEADER = 'name,category,brand,sku,price,salePrice,stock,weight,hsnCode,gstRate,moq,description';
  const csv = (rows) => Buffer.from([HEADER, ...rows].join('\r\n'), 'utf8');

  it('serves a template with the expected columns', async () => {
    const { token } = await createVendor();
    const res = await request(app).get('/vendor/products/import/template').set(auth(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text[/]csv/);
    expect(res.text).toContain('name,category');
  });

  it('imports the good rows and reports the bad ones by line number', async () => {
    const { vendor, token } = await createVendor();
    const category = await createCategory({ name: `Importable ${uniqueSuffix()}` });

    const res = await request(app)
      .post('/vendor/products/import')
      .set(auth(token))
      .attach(
        'file',
        csv([
          `Good One,${category.name},,,500,,10,,,,,Fine`,
          'Bad Category,No Such Category,,,500,,10,,,,,Nope',
          `Bad Price,${category.name},,,abc,,10,,,,,Nope`,
          `Bad GST,${category.name},,,500,,10,,,7,,Nope`,
        ]),
        'products.csv'
      );

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.failed).toHaveLength(3);

    // Line numbers match the seller's spreadsheet gutter, header included.
    expect(res.body.data.failed.map((f) => f.line)).toEqual([3, 4, 5]);
    expect(res.body.data.failed[0].error).toMatch(/category/i);
    expect(res.body.data.failed[1].error).toMatch(/price/i);
    expect(res.body.data.failed[2].error).toMatch(/gstRate/i);

    const saved = await Product.findOne({ vendor: vendor._id, name: 'Good One' });
    expect(saved).toBeTruthy();
    // The pre-save hook still runs, so a bulk-imported product gets a barcode.
    expect(saved.barcode).toBeTruthy();
  });

  it('writes nothing on a dry run', async () => {
    const { vendor, token } = await createVendor();
    const category = await createCategory({ name: `DryRun ${uniqueSuffix()}` });

    const res = await request(app)
      .post('/vendor/products/import')
      .set(auth(token))
      .field('dryRun', 'true')
      .attach('file', csv([`Preview Only,${category.name},,,500,,10,,,,,`]), 'products.csv');

    expect(res.status).toBe(200);
    expect(res.body.data.dryRun).toBe(true);
    expect(res.body.data.readyCount).toBe(1);
    expect(await Product.countDocuments({ vendor: vendor._id })).toBe(0);
  });

  it('catches a SKU used twice within the same file', async () => {
    const { token } = await createVendor();
    const category = await createCategory({ name: `DupSku ${uniqueSuffix()}` });
    const sku = `DUP-${uniqueSuffix()}`;

    const res = await request(app)
      .post('/vendor/products/import')
      .set(auth(token))
      .attach(
        'file',
        csv([`One,${category.name},,${sku},500,,1,,,,,`, `Two,${category.name},,${sku},500,,1,,,,,`]),
        'p.csv'
      );

    expect(res.body.data.created).toBe(1);
    expect(res.body.data.failed[0].error).toMatch(/twice in this file/i);
  });

  it('refuses a file missing a required column', async () => {
    const { token } = await createVendor();
    const res = await request(app)
      .post('/vendor/products/import')
      .set(auth(token))
      .attach('file', Buffer.from(['name,price', 'No Category,100'].join('\r\n'), 'utf8'), 'p.csv');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/missing required columns/i);
  });
});
