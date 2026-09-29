// Seller panel in a real browser: sign in → Orders → open the buyer's order →
// Start Processing → Mark Shipped (hand-entered AWB) → Mark Delivered.
// Each step must show in the open dialog straight away (it used to keep the
// stale status), and a seller-declared delivery must reach the admin's
// "Delivery unconfirmed" queue rather than go straight to payout (QA-003).

const { test, expect, API, seed } = require('./fixtures');

async function placeOrderForSeller(request, { buyerIndex, productIndex }) {
  const { buyers, productIds } = seed();
  const b = buyers[buyerIndex];
  const headers = { Authorization: `Bearer ${b.token}` };
  await request.post(`${API}/user/cart/items`, { headers, data: { productId: productIds[productIndex], quantity: 1 } });
  const placed = await request.post(`${API}/user/orders`, { headers, data: { addressId: b.addressId, paymentMethod: 'COD' } });
  expect(placed.status()).toBe(201);
  return (await placed.json()).data.id;
}

async function loginAsSeller(page, email) {
  await page.goto('/seller/login');
  await page.getByRole('textbox', { name: 'seller@example.com' }).fill(email);
  await page.getByRole('textbox', { name: '••••••••' }).fill('secret123');
  await page.getByRole('button', { name: /^Sign In/ }).click();
  await expect(page).toHaveURL(/\/seller\/(?!login)/);
}

test('a seller processes, ships and delivers an order; the payout waits for confirmation', async ({ page, request }) => {
  // Product 26 belongs to seed seller 6 (products are dealt round-robin to 20 sellers).
  const orderId = await placeOrderForSeller(request, { buyerIndex: 1, productIndex: 26 });
  const shortId = orderId.slice(-8).toUpperCase();

  await loginAsSeller(page, 'load.vendor6@test.local');
  await page.getByRole('link', { name: 'Orders' }).first().click();
  const row = page.getByRole('row', { name: new RegExp(shortId) });
  await expect(row).toContainText('PENDING');
  await row.click();

  const dialog = page.getByRole('dialog', { name: `Order #${shortId}` });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Start Processing' }).click();
  await expect(dialog).toContainText(/Status\s*PROCESSING/);

  await dialog.getByRole('textbox', { name: 'Tracking number' }).fill('E2E-AWB-0001');
  await dialog.getByRole('textbox', { name: 'Courier (optional)' }).fill('Delhivery');
  await dialog.getByRole('button', { name: 'Mark Shipped' }).click();
  await expect(dialog).toContainText(/Status\s*SHIPPED/);

  await dialog.getByRole('button', { name: /Mark Delivered/ }).click();
  await expect(dialog).toContainText(/Status\s*DELIVERED/);

  // The list agrees once the dialog closes.
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('row', { name: new RegExp(shortId) })).toContainText('DELIVERED');

  // Seller-declared: held for confirmation, not paid out.
  const { adminToken } = seed();
  const res = await request.get(`${API}/admin/orders?tab=delivery_unconfirmed&rowsPerPage=100`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const order = (await res.json()).data.items.find((o) => o.id === orderId);
  expect(order).toBeTruthy();
  expect(order.items.some((i) => i.awaitingDeliveryConfirmation)).toBe(true);
});

test('another seller cannot see the order', async ({ page, request }) => {
  const orderId = await placeOrderForSeller(request, { buyerIndex: 2, productIndex: 27 }); // seller 7
  await loginAsSeller(page, 'load.vendor8@test.local');
  await page.getByRole('link', { name: 'Orders' }).first().click();
  await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(orderId.slice(-8).toUpperCase()) })).toHaveCount(0);
});

test('a wrong seller password is refused on screen', async ({ page }) => {
  await page.goto('/seller/login');
  await page.getByRole('textbox', { name: 'seller@example.com' }).fill('load.vendor9@test.local');
  await page.getByRole('textbox', { name: '••••••••' }).fill('not-the-password');
  await page.getByRole('button', { name: /^Sign In/ }).click();
  await expect(page.getByText(/invalid email or password/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/seller\/login/);
});
