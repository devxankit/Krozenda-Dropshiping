// Admin panel in a real browser.
//  1. A seller marks their own line delivered (API). The admin finds it under
//     Orders → "Delivery unconfirmed", opens it and confirms the delivery,
//     which releases it to settlement (QA-003 payout hold).
//  2. The product list pages and searches on the server.

const { test, expect, API, seed } = require('./fixtures');

async function loginAsAdmin(page) {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Work email' }).fill('load.admin@test.local');
  await page.getByRole('textbox', { name: 'Password' }).fill('Admin@12345');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/admin\/(?!login)/);
}

async function sellerDeliveredOrder(request) {
  const { buyers, productIds, vendorTokens } = seed();
  const b = buyers[3];
  const buyer = { Authorization: `Bearer ${b.token}` };
  const productId = productIds[6]; // seller 6 (products are dealt round-robin to 20 sellers)
  await request.post(`${API}/user/cart/items`, { headers: buyer, data: { productId, quantity: 1 } });
  const placed = await request.post(`${API}/user/orders`, { headers: buyer, data: { addressId: b.addressId, paymentMethod: 'COD' } });
  const orderId = (await placed.json()).data.id;
  const seller = { Authorization: `Bearer ${vendorTokens[6]}` };
  const path = `${API}/vendor/orders/${orderId}/items/${productId}/status`;
  for (const data of [{ status: 'PROCESSING' }, { status: 'SHIPPED', trackingNumber: 'E2E-AWB-2' }, { status: 'DELIVERED' }]) {
    const res = await request.patch(path, { headers: seller, data });
    expect(res.status()).toBe(200);
  }
  return orderId;
}

test('admin confirms a seller-declared delivery from the order screen', async ({ page, request }) => {
  const orderId = await sellerDeliveredOrder(request);
  const shortId = orderId.slice(-8).toUpperCase();

  await loginAsAdmin(page);
  await page.goto('/admin/orders');
  await page.getByRole('tab', { name: /Delivery unconfirmed/ }).click();
  const row = page.getByRole('row', { name: new RegExp(shortId, 'i') });
  await expect(row).toBeVisible();
  await row.click();

  await expect(page.getByRole('heading', { name: `Order ${shortId}` })).toBeVisible();
  await expect(page.getByText('Delivered · seller-marked')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm delivery' }).click();
  await expect(page.getByText('Delivered · seller-marked')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm delivery' })).toHaveCount(0);

  // Released: no longer waiting in the queue.
  const { adminToken } = seed();
  const res = await request.get(`${API}/admin/orders?tab=delivery_unconfirmed&rowsPerPage=100`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect((await res.json()).data.items.map((o) => o.id)).not.toContain(orderId);
});

test('the product list pages and searches on the server', async ({ page }) => {
  await loginAsAdmin(page);
  const pageRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('/admin/catalog/products?')) pageRequests.push(req.url());
  });
  await page.goto('/admin/catalog/products');
  await expect(page.getByText('shoe model 26').or(page.getByText(/model \d+/).first()).first()).toBeVisible();
  // the list asked for one page, not the whole catalogue
  expect(pageRequests.some((u) => /[?&]page=1/.test(u) && /[?&]limit=\d+/.test(u))).toBe(true);

  await page.getByPlaceholder('Product name, SKU, brand…').fill('LOAD-26');
  await expect(page.getByText('shoe model 26').first()).toBeVisible();
  await expect.poll(() => pageRequests.some((u) => u.includes('search=LOAD-26'))).toBe(true);
});
