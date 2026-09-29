// Buyer golden path in a real browser: OTP sign-in → product → cart → new
// address at checkout → summary → Cash on Delivery → order placed → My Orders.
// Also checked against the API: the stock actually moved.

const { test, expect, seed } = require('./fixtures');
const { loginAsBuyer, addProductToCart, addAddressAtCheckout, apiGet, summaryTotal } = require('./helpers');

test.describe('buyer checkout (COD)', () => {
  test('a new buyer signs in, adds an address and places a COD order', async ({ page, request }) => {
    const { productIds } = seed();
    const productId = productIds[26];
    const before = await apiGet(request, `/catalog/products/${productId}`);
    const productName = before.body.data.name;

    await loginAsBuyer(page);
    await addProductToCart(page, productId);

    await page.goto('/app/cart');
    await expect(page.getByRole('heading', { name: /My Cart \(1\)/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: productName })).toBeVisible();
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();

    await expect(page.getByRole('heading', { name: 'Select Delivery Address' })).toBeVisible();
    await addAddressAtCheckout(page);
    await page.getByRole('button', { name: 'Deliver to this Address' }).click();

    await expect(page.getByRole('heading', { name: 'Review Order Details' })).toBeVisible();
    const total = await summaryTotal(page);
    await page.getByRole('button', { name: /Proceed to Payment/ }).click();

    await expect(page.getByRole('heading', { name: 'Select Payment Method' })).toBeVisible();
    await page.getByRole('radio', { name: /Cash on Delivery/ }).click();
    await page.getByRole('button', { name: /^Place Order/ }).click();

    await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();
    const row = page.getByRole('link', { name: /Order #/ }).first();
    await expect(row).toContainText('Pending');
    await expect(row).toContainText(productName);
    // the amount on the order is the amount the summary promised
    expect((await row.innerText()).match(/₹[\d,]+/)[0]).toBe(total);
    await page.goto('/app/cart');
    await expect(page.getByRole('heading', { name: /My Cart \(1\)/ })).toHaveCount(0);

    const after = await apiGet(request, `/catalog/products/${productId}`);
    expect(after.body.data.stock).toBe(before.body.data.stock - 1);
  });

  test('a guest opening the cart is sent to sign in', async ({ page }) => {
    await page.goto('/app/cart');
    await expect(page).toHaveURL(/\/auth\//);
  });

  test('an invalid coupon is refused with a message and the total is unchanged', async ({ page }) => {
    const { productIds } = seed();
    await loginAsBuyer(page);
    await addProductToCart(page, productIds[3]);
    await page.goto('/app/cart');
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
    await addAddressAtCheckout(page);
    await page.getByRole('button', { name: 'Deliver to this Address' }).click();
    const total = await summaryTotal(page);
    await page.getByPlaceholder('Enter coupon code').fill('NOSUCHCODE');
    await page.getByRole('button', { name: 'Apply' }).click();
    // shown inline and as a toast
    await expect(page.getByText('Invalid coupon code').first()).toBeVisible();
    expect(await summaryTotal(page)).toBe(total);
  });
});

test.describe('mobile navigation', () => {
  test('the cart can be reached from the mobile home screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile layout only');
    await loginAsBuyer(page);
    await page.goto('/app/dashboard');
    const cartEntry = page.getByRole('button', { name: /cart/i }).or(page.getByRole('link', { name: /cart/i }));
    await expect(cartEntry.first()).toBeVisible();
  });
});

test.describe('mobile product page cart link (QA-038)', () => {
  test('after adding an item, the product page links straight to the cart', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile layout only');
    const { productIds } = seed();
    await loginAsBuyer(page);
    await addProductToCart(page, productIds[17]);
    const name = await page.getByRole('heading', { level: 1 }).first().innerText();
    const cart = page.getByRole('button', { name: 'Cart, 1 items' });
    await expect(cart).toBeVisible();
    await cart.click();
    await expect(page).toHaveURL(/\/app\/cart/);
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });
});
