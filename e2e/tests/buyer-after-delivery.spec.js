// After delivery, in a real browser: the buyer reviews the product and raises
// a refund claim. Setup (order → seller delivers) is done through the API;
// everything the buyer does is through the screens.
//
// The review carries a harmless HTML payload: it must come back as text on
// the product page, never as markup.

const { test, expect, API, seed } = require('./fixtures');
const { loginAsBuyer } = require('./helpers');

const XSS = '<img src=x onerror="window.__xss=1"> nice saree';

async function deliveredOrder(request, { buyerIndex, productIndex }) {
  const { buyers, productIds, vendorTokens } = seed();
  const b = buyers[buyerIndex];
  const productId = productIds[productIndex];
  const vendorToken = vendorTokens[productIndex % 20]; // products are dealt round-robin to 20 sellers
  const buyer = { Authorization: `Bearer ${b.token}` };
  await request.post(`${API}/user/cart/items`, { headers: buyer, data: { productId, quantity: 1 } });
  const placed = await request.post(`${API}/user/orders`, { headers: buyer, data: { addressId: b.addressId, paymentMethod: 'COD' } });
  const orderId = (await placed.json()).data.id;
  const seller = { Authorization: `Bearer ${vendorToken}` };
  for (const data of [{ status: 'PROCESSING' }, { status: 'SHIPPED', trackingNumber: 'AWB-R' }, { status: 'DELIVERED' }]) {
    const res = await request.patch(`${API}/vendor/orders/${orderId}/items/${productId}/status`, { headers: seller, data });
    expect(res.status()).toBe(200);
  }
  return { orderId, productId, buyer: b };
}

test('the buyer reviews a delivered product; the review shows on the product page as text', async ({ page, request }, testInfo) => {
  const buyerIndex = testInfo.project.name === 'mobile-chromium' ? 21 : 20;
  const { orderId, productId, buyer } = await deliveredOrder(request, { buyerIndex, productIndex: 11 + buyerIndex });
  await loginAsBuyer(page, buyer.mobileNumber);

  await page.goto(`/app/orders/${orderId}/review`);
  await expect(page.getByRole('heading', { name: 'How would you rate this product?' })).toBeVisible();
  await page.getByRole('button', { name: '4 stars' }).click();
  await expect(page.getByRole('button', { name: '4 stars' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('textbox', { name: 'Your review' }).fill(XSS);
  await page.getByRole('button', { name: 'Submit Review' }).click();
  await expect(page.getByText(/review (submitted|saved|posted)|thank/i).first()).toBeVisible();

  const reviews = await request.get(`${API}/user/reviews?productId=${productId}`);
  const mine = (await reviews.json()).data.items.find((r) => r.reviewText.includes('nice saree'));
  expect(mine).toBeTruthy();
  expect(mine.rating).toBe(4);

  await page.goto(`/app/product/${productId}`);
  await page.getByRole('tab', { name: 'Customer Reviews' }).click();
  await expect(page.getByText('nice saree', { exact: false }).first()).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('the buyer raises a refund claim for a delivered item', async ({ page, request }, testInfo) => {
  const buyerIndex = testInfo.project.name === 'mobile-chromium' ? 23 : 22;
  const { orderId, buyer } = await deliveredOrder(request, { buyerIndex, productIndex: 1 + buyerIndex - 20 });
  await loginAsBuyer(page, buyer.mobileNumber);

  await page.goto('/app/returns');
  await expect(page.getByRole('heading', { name: 'Request Return or Replacement' })).toBeVisible();
  await expect(page.getByRole('combobox').filter({ hasText: 'Order #' })).toContainText(orderId.slice(-8).toUpperCase());
  await page.getByRole('heading', { name: 'Full Refund' }).click();
  await page.getByText('Defective / Not Working').click();
  await expect(page.getByText(/Request Type:\s*(Full )?Refund/i)).toBeVisible();
  await page.getByRole('button', { name: /Submit Return Claim/ }).click();
  await expect(page.getByText(/submitted|raised|received|request/i).first()).toBeVisible();

  const res = await request.get(`${API}/user/returns`, { headers: { Authorization: `Bearer ${buyer.token}` } });
  const claim = (await res.json()).data.items.find((c) => c.orderId === orderId);
  expect(claim).toBeTruthy();
});
