// Admin panel in a real browser.
//  1. A seller marks their own line delivered (API). The admin finds it under
//     Orders → "Delivery unconfirmed", opens it and confirms the delivery,
//     which releases it to settlement (QA-003 payout hold).
//  2. The product list pages and searches on the server.
//  3. A placed order shows up under Invoices and its tax invoice opens.
//  4. Categories import from a CSV: preview, then import; re-importing skips.
//  5. Customers: export only the selected rows. Integration health re-checks.
//  6. Business rules save to the real policy. My profile edits the account.

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

test('a placed order is listed under Invoices and its tax invoice opens', async ({ page, request }) => {
  const { buyers, productIds } = seed();
  const b = buyers[4];
  const buyer = { Authorization: `Bearer ${b.token}` };
  await request.post(`${API}/user/cart/items`, { headers: buyer, data: { productId: productIds[7], quantity: 1 } });
  const placed = await request.post(`${API}/user/orders`, { headers: buyer, data: { addressId: b.addressId, paymentMethod: 'COD' } });
  const orderId = (await placed.json()).data.id;
  const number = `INV-${orderId.slice(-10).toUpperCase()}`;

  await loginAsAdmin(page);
  await page.goto('/admin/orders/invoices');
  await page.getByPlaceholder(/Invoice number/).fill(number);
  const row = page.getByRole('row', { name: new RegExp(number) });
  await expect(row).toBeVisible();
  await row.click();

  await expect(page.getByRole('heading', { name: number })).toBeVisible();
  await expect(page.getByText('Cash on delivery (not yet collected)').first()).toBeVisible();
  await expect(page.getByText(/TAX INVOICE|BILL OF SUPPLY/).first()).toBeVisible();
});

test('categories import from a CSV file, and a second import skips them', async ({ page }) => {
  const stamp = Date.now()
  const csv = ['name,active,top_category,food', `E2E Import A ${stamp},yes,no,no`, `"E2E Import, B ${stamp}",no,yes,no`].join(String.fromCharCode(13, 10))
  const file = { name: 'categories.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }

  await loginAsAdmin(page)
  await page.goto('/admin/catalog/categories')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Import categories' })
  await dialog.getByLabel('CSV file').setInputFiles(file)
  await expect(dialog.getByText('2 to create')).toBeVisible()
  await dialog.getByRole('button', { name: 'Import 2 categories' }).click()
  await expect(dialog).toBeHidden()

  await page.getByPlaceholder(/Search/i).first().fill(`E2E Import A ${stamp}`)
  await expect(page.getByText(`E2E Import A ${stamp}`).first()).toBeVisible()

  // The same file again: both names exist, nothing to import.
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await dialog.getByLabel('CSV file').setInputFiles(file)
  await expect(dialog.getByText('2 skipped')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
})

test('customers export only the selected rows; integration health re-checks', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/admin/people/customers')
  const boxes = page.locator('tbody [id^="table-select-"]')
  await expect(boxes.first()).toBeVisible()
  await boxes.nth(0).check({ force: true })
  await boxes.nth(1).check({ force: true })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export selected' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('customers-selected.csv')
  const csv = (await (await download.createReadStream()).toArray()).join('')
  const lines = csv.trim().split(String.fromCharCode(10))
  expect(lines).toHaveLength(3) // header + the two selected
  // The per-row Block/Unblock stays; the bulk bar only offers what works.
  await expect(page.getByRole('button', { name: 'Send campaign' })).toHaveCount(0)

  await page.goto('/admin/settings/integrations')
  await expect(page.getByRole('button', { name: 'Configure' })).toHaveCount(0)
  const recheck = page.waitForResponse((r) => r.url().includes('/admin/settings/integrations') && r.status() === 200)
  await page.getByRole('button', { name: 'Re-check now' }).click()
  await recheck
})

test('business rules are the real policy: a saved rule survives a reload', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/admin/settings/business-rules')
  const hold = page.getByLabel('Hold after delivery')
  await expect(hold).toHaveValue('7')
  await hold.fill('9')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Business rules saved')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Hold after delivery')).toHaveValue('9')
  // Shorter than the 7-day return window: the page says so.
  await page.getByLabel('Hold after delivery').fill('3')
  await expect(page.getByText('Hold is shorter than the return window')).toBeVisible()
  await page.getByLabel('Hold after delivery').fill('7')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Business rules saved').first()).toBeVisible()
})

test('my profile: open from the topbar, rename, and a wrong current password is refused', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/admin/dashboard')
  await page.locator('header').getByRole('button').filter({ hasText: /admin/i }).first().click()
  await page.getByText('My profile', { exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/admin/profile')
  await expect(page.getByLabel('Email')).toHaveValue('load.admin@test.local')

  const name = page.getByLabel('Name')
  const original = await name.inputValue()
  await name.fill('E2E Admin Renamed')
  await page.getByRole('button', { name: 'Save details' }).click()
  await expect(page.getByText('Profile updated')).toBeVisible()
  await expect(page.locator('header').getByText('E2E Admin Renamed').first()).toBeVisible()
  await page.getByLabel('Name').fill(original)
  await page.getByRole('button', { name: 'Save details' }).click()

  await page.getByLabel('Current password', { exact: true }).fill('not-my-password')
  await page.getByLabel('New password', { exact: true }).fill('Another#123')
  await page.getByLabel('Confirm new password').fill('Another#123')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('Current password is incorrect')).toBeVisible()
})
