// A seller lists a product through the seller panel (with a real image
// upload); it waits for admin approval, invisible to buyers; the admin
// approves it in the admin panel; buyers can then see it.
//
// Form fields are found by their labels — which also checks that the labels
// are linked to their inputs (they were not; fixed in the shared Input).

const path = require('path');
const { test, expect, API, seed } = require('./fixtures');

const IMAGE = path.join(__dirname, 'assets', 'product.png');

async function loginAsSeller(page, email) {
  await page.goto('/seller/login');
  await page.getByRole('textbox', { name: 'seller@example.com' }).fill(email);
  await page.getByRole('textbox', { name: '••••••••' }).fill('secret123');
  await page.getByRole('button', { name: /^Sign In/ }).click();
  await expect(page).toHaveURL(/\/seller\/(?!login)/);
}

async function adminGet(request, pathname) {
  const res = await request.get(`${API}${pathname}`, { headers: { Authorization: `Bearer ${seed().adminToken}` } });
  return (await res.json()).data;
}

test('seller lists a product → pending and hidden → admin approves → buyers see it', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'seller and admin panels are desktop screens');
  const stamp = Date.now();
  const name = `E2E Kettle ${stamp}`;
  const sku = `E2E-KET-${stamp}`;

  await loginAsSeller(page, 'load.vendor3@test.local');
  await page.getByRole('link', { name: 'Products' }).first().click();
  await page.getByRole('button', { name: /Add Product/ }).first().click();
  const form = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Add New Product' }) });

  await form.locator('input[type="file"]').first().setInputFiles(IMAGE);
  await form.getByLabel('Product Name').fill(name);
  await form.getByLabel('SKU Identifier').fill(sku);
  await form.getByLabel('Category', { exact: false }).first().selectOption({ label: 'Category 3' });
  await form.getByLabel('Selling Price (₹)').fill('499');
  await form.getByLabel('MRP (₹, Optional)').fill('699');
  await form.getByLabel('Stock Quantity').fill('25');
  await form.getByLabel('Weight (kg)').fill('0.5');
  await form.getByRole('button', { name: 'Submit product for review' }).click();
  // The new card, marked Pending, is the seller-visible confirmation.
  const card = page.getByText(name).first();
  await expect(card).toBeVisible();

  // Stored, owned by this seller, waiting for review, not on sale.
  const listed = await adminGet(request, `/admin/catalog/products?page=1&search=${encodeURIComponent(sku)}`);
  expect(listed.items).toHaveLength(1);
  const product = listed.items[0];
  expect(product.approvalStatus).toBe('PENDING');
  expect((await request.get(`${API}/catalog/products/${product.id}`)).status()).toBe(404);
  expect(product.images.length).toBeGreaterThan(0);

  // Admin approves it from the approval queue.
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Work email' }).fill('load.admin@test.local');
  await page.getByRole('textbox', { name: 'Password' }).fill('Admin@12345');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/admin\/(?!login)/);
  await page.goto('/admin/catalog/approvals');
  const item = page.getByRole('heading', { name, level: 4 });
  await expect(item).toBeVisible();
  const queueCard = page.locator('div', { has: item }).filter({ has: page.getByRole('button', { name: 'Approve' }) }).last();
  await queueCard.getByRole('button', { name: 'Approve' }).click();
  // Approving a seller product asks for an optional product commission;
  // skipping keeps the seller's / category's / platform default.
  const dialog = page.getByRole('dialog', { name: `Approve ${name}?` });
  await dialog.getByRole('button', { name: 'Skip & approve' }).click();
  await expect(page.getByRole('heading', { name, level: 4 })).toHaveCount(0);

  // On sale now: the storefront serves it, and a buyer can open it.
  await expect.poll(async () => (await request.get(`${API}/catalog/products/${product.id}`)).status()).toBe(200);
  await page.goto(`/app/product/${product.id}`);
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
});
