// Every admin sidebar module, opened in a real browser: it must render
// without the error screen, throw no page errors, and get no 4xx/5xx from
// the API while loading. One test per module, so a report names the module.

const { test, expect, API } = require('./fixtures');

test.describe.configure({ mode: 'serial' });
const desktopOnly = () =>
  test.skip(test.info().project.name !== 'desktop-chromium', 'admin panel is a desktop screen');

async function loginAsAdmin(page) {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Work email' }).fill('load.admin@test.local');
  await page.getByRole('textbox', { name: 'Password' }).fill('Admin@12345');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/admin\/(?!login)/);
}

// API errors that are expected on this stack, each with its reason. Anything
// not listed here fails the test.
const EXPECTED_API_ERRORS = [
  // CJ is not connected on the isolated stack (no credentials): the catalogue
  // screens answer 400 "not connected" and show that state.
  /^400 \/admin\/cj\/catalogue/,
  // QA-033 (open, owner's decision): the Invoices screen has no backend yet.
  /^404 \/admin\/invoices/,
];

// Collected once from the real sidebar, so a new module is covered without
// editing this file.
let modules = [];

test('collect sidebar modules', async ({ page }) => {
  desktopOnly();
  await loginAsAdmin(page);
  // Sidebar groups may be an accordion (opening one closes another), so open
  // them one at a time and collect the links visible after each — the union
  // is every module, whatever the timing.
  const collect = () =>
    page.locator('a[href^="/admin/"]').evaluateAll((els) =>
      els.map((a) => ({ label: a.textContent.trim().replace(/\s+/g, ' '), href: a.getAttribute('href') }))
    );
  const links = await collect();
  const toggles = page.locator('aside button[aria-expanded], nav button[aria-expanded]');
  for (let i = 0; i < (await toggles.count()); i += 1) {
    const toggle = toggles.nth(i);
    const label = ((await toggle.getAttribute('aria-label')) || (await toggle.innerText())).trim();
    if (/collapse sidebar|expand sidebar/i.test(label)) continue;
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click().catch(() => {});
    links.push(...(await collect()));
  }
  modules = [...new Map(links.filter((l) => l.href && l.href.startsWith('/admin')).map((l) => [l.href, l])).values()];
  expect(modules.length).toBeGreaterThan(10);
  test.info().annotations.push({ type: 'modules', description: String(modules.length) });
});

test('every sidebar module loads cleanly', async ({ page }) => {
  desktopOnly();
  test.setTimeout(15 * 60 * 1000);
  await loginAsAdmin(page);
  const problems = [];
  for (const { label, href } of modules) {
    const apiErrors = [];
    const pageErrors = [];
    const onResponse = (res) => {
      if (!res.url().startsWith(API) || res.status() < 400) return;
      const line = `${res.status()} ${res.url().slice(API.length)}`;
      if (!EXPECTED_API_ERRORS.some((re) => re.test(line))) apiErrors.push(line);
    };
    const onPageError = (err) => pageErrors.push(err.message);
    page.on('response', onResponse);
    page.on('pageerror', onPageError);

    await page.goto(href);
    // Some screens poll or hold a socket open, so "idle" may never come;
    // five seconds is enough for a screen's first loads to land.
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const errorScreen = await page.getByText(/That didn.t load|Something went wrong|You do not have access/i).count();

    page.off('response', onResponse);
    page.off('pageerror', onPageError);
    if (apiErrors.length || pageErrors.length || errorScreen) {
      problems.push({ label, href, apiErrors, pageErrors, errorScreen });
    }
  }
  console.log(`[admin-smoke] ${modules.length} modules checked, ${problems.length} with problems`);
  for (const p of problems) console.log(`[admin-smoke] ${JSON.stringify(p)}`);
  expect(problems).toEqual([]);
});
