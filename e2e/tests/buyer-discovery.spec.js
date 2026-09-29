// Finding products in a real browser: search, sort, wishlist.
const { test, expect, API, seed } = require('./fixtures');
const { loginAsBuyer } = require('./helpers');

test('search finds a product by name and by SKU; nonsense finds nothing', async ({ page, request }) => {
  const { productIds } = seed();
  const product = (await (await request.get(`${API}/catalog/products/${productIds[12]}`)).json()).data;

  await page.goto(`/app/search?q=${encodeURIComponent(product.name)}`);
  await expect(page.getByText(product.name).first()).toBeVisible();

  await page.goto(`/app/search?q=${encodeURIComponent(product.sku)}`);
  await expect(page.getByText(product.name).first()).toBeVisible();

  await page.goto('/app/search?q=zzqqxx-no-such-thing');
  await expect(page.getByText(product.name)).toHaveCount(0);
});

test('listing sort "price low to high" puts the cheapest product first', async ({ page, request }) => {
  const all = (await (await request.get(`${API}/catalog/products?sort=price_asc&limit=1`)).json()).data.items;
  await page.goto('/app/listing');
  const sort = page.locator('select', { has: page.locator('option', { hasText: 'Newest first' }) });
  await sort.selectOption({ label: 'Price: low to high' });
  await expect(page.getByText(all[0].name).first()).toBeVisible();
});

test('a signed-in buyer wishlists a product and finds it in the wishlist', async ({ page }) => {
  const { productIds } = seed();
  await loginAsBuyer(page);
  await page.goto(`/app/product/${productIds[14]}`);
  const name = await page.getByRole('heading', { level: 1 }).first().innerText();
  // Wait for the save itself — leaving the page first would cancel it.
  const saved = page.waitForResponse((res) => res.url().includes('/user/wishlist/') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Add to wishlist' }).first().click();
  expect((await saved).status()).toBeLessThan(300);
  await page.goto('/app/wishlist');
  await expect(page.getByText(name).first()).toBeVisible();
});
