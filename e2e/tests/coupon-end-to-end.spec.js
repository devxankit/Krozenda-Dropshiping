// A coupon from creation to redemption, all through the screens: the admin
// creates a ₹100 flat coupon in the admin panel; a buyer applies it at
// checkout and places the order at ₹100 less. Checked against the API: the
// order carries the discount and the coupon counts one use.

const { test, expect, API, seed } = require('./fixtures');
const { loginAsBuyer, addProductToCart, addAddressAtCheckout, summaryTotal } = require('./helpers');

const rupees = (text) => Number(String(text).replace(/[^\d.]/g, ''));

test('admin creates a flat coupon; a buyer redeems it at checkout', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'admin panel is a desktop screen');
  const code = `E2EFLAT${Date.now().toString().slice(-7)}`;
  const endDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Work email' }).fill('load.admin@test.local');
  await page.getByRole('textbox', { name: 'Password' }).fill('Admin@12345');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/admin\/(?!login)/);
  await page.goto('/admin/marketing/coupons');
  await page.getByRole('button', { name: /new coupon|create coupon|add coupon/i }).first().click();
  const form = page.getByRole('dialog', { name: 'New coupon' });
  await form.getByRole('textbox', { name: 'Coupon Code' }).fill(code);
  await form.getByRole('button', { name: '₹ Flat amount' }).click();
  await form.getByRole('spinbutton').first().fill('100');
  await form.getByRole('textbox', { name: 'End Date' }).fill(endDate);
  await form.getByRole('button', { name: 'Create coupon' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText(code).first()).toBeVisible();

  // A buyer, in the same browser after the admin session is left.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await loginAsBuyer(page);
  await addProductToCart(page, seed().productIds[33]);
  await page.goto('/app/cart');
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await addAddressAtCheckout(page);
  await page.getByRole('button', { name: 'Deliver to this Address' }).click();

  const before = rupees(await summaryTotal(page));
  await page.getByPlaceholder('Enter coupon code').fill(code);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect.poll(async () => rupees(await summaryTotal(page))).toBe(before - 100);

  await page.getByRole('button', { name: /Proceed to Payment/ }).click();
  await page.getByRole('radio', { name: /Cash on Delivery/ }).click();
  await page.getByRole('button', { name: /^Place Order/ }).click();
  await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();

  const admin = { Authorization: `Bearer ${seed().adminToken}` };
  const orders = await (await request.get(`${API}/admin/orders?rowsPerPage=100`, { headers: admin })).json();
  const order = orders.data.items.find((o) => o.couponCode === code);
  expect(order).toBeTruthy();
  expect(order.discountAmount).toBe(10000); // paise
  const coupons = await (await request.get(`${API}/admin/marketing/coupons?search=${code}`, { headers: admin })).json();
  expect(coupons.data.items[0].usedCount).toBe(1);
});
