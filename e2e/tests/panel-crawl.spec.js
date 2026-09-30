// Every screen an admin or a seller can reach by clicking links — sidebar,
// settings sub-menus, tabs, detail pages — opened in a real browser and held
// to the same bar as the admin smoke: no error screen, no page error, no
// unexpected 4xx/5xx from the API.

const { test, expect } = require('./fixtures');
const { crawlPanel } = require('./crawl');

test.describe.configure({ mode: 'serial' });
const desktopOnly = () => test.skip(test.info().project.name !== 'desktop-chromium', 'desktop crawl');

test('admin: every reachable screen loads cleanly', async ({ page }) => {
  desktopOnly();
  test.setTimeout(20 * 60 * 1000);
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Work email' }).fill('load.admin@test.local');
  await page.getByRole('textbox', { name: 'Password' }).fill('Admin@12345');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/admin\/(?!login)/);

  const { problems } = await crawlPanel({
    page,
    prefix: '/admin/',
    tag: 'admin-crawl',
    skip: [/\/admin\/login/, /logout/],
    expectedApiErrors: [
      // CJ is not connected on the isolated stack (no credentials).
      /^400 \/admin\/cj\/catalogue/,
    ],
    // ...so the CJ catalogue screens show their "not connected" error state.
    expectedErrorScreens: [/\/admin\/cj\/(catalogue|category)$/],
  });
  expect(problems).toEqual([]);
});

test('seller: every reachable screen loads cleanly', async ({ page }) => {
  desktopOnly();
  test.setTimeout(20 * 60 * 1000);
  await page.goto('/seller/login');
  await page.getByRole('textbox', { name: 'seller@example.com' }).fill('load.vendor6@test.local');
  await page.getByRole('textbox', { name: '••••••••' }).fill('secret123');
  await page.getByRole('button', { name: /^Sign In/ }).click();
  await expect(page).toHaveURL(/\/seller\/(?!login)/);

  const { problems } = await crawlPanel({
    page,
    prefix: '/seller/',
    tag: 'seller-crawl',
    skip: [/\/seller\/login/, /\/seller\/(register|signup|forgot|reset)/, /logout/],
    expectedApiErrors: [],
  });
  expect(problems).toEqual([]);
});
