// A panel crawler for the smoke specs. Starting from the sidebar, it opens
// every screen a user can reach by following links: each screen must render
// without the error screen, throw no page errors and get no 4xx/5xx from the
// API. Links found on a screen are followed too (settings sub-menus, tabs,
// detail pages), one screen per route pattern, so ids do not multiply visits.

const { expect, API } = require('./fixtures');

// The panel's error state (a dashed red alert box), its not-found and
// forbidden screens. Inline warnings are role="alert" too, but not dashed.
const ERROR_SCREEN = 'main [role="alert"].border-dashed, main :text("No screen at this address"), main :text("You do not have access")';

// "/admin/orders/detail/6abc…" and "/admin/orders/detail/6abd…" are one screen.
const patternOf = (href) =>
  href
    .split('?')[0]
    .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id')
    .replace(/\/(?:INV|KZ|RET|TKT)?-?[0-9A-F-]{6,}(?=\/|$)/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:n');

async function collectLinks(page, prefix) {
  return page.locator(`a[href^="${prefix}"]`).evaluateAll((els) =>
    els.map((a) => ({ label: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 60), href: a.getAttribute('href') }))
  );
}

// Sidebar groups may be accordions (opening one closes another), so open them
// one at a time and keep the union of links seen after each.
async function collectSidebar(page, prefix) {
  const links = await collectLinks(page, prefix);
  const toggles = page.locator('aside button[aria-expanded], nav button[aria-expanded]');
  for (let i = 0; i < (await toggles.count()); i += 1) {
    const toggle = toggles.nth(i);
    const label = ((await toggle.getAttribute('aria-label')) || (await toggle.innerText())).trim();
    if (/collapse sidebar|expand sidebar|navigation/i.test(label)) continue;
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click().catch(() => {});
    links.push(...(await collectLinks(page, prefix)));
  }
  return links;
}

/**
 * @param {object} o
 * @param {import('@playwright/test').Page} o.page  signed in
 * @param {string} o.prefix        "/admin/" or "/seller/"
 * @param {RegExp[]} o.expectedApiErrors  "<status> <path>" lines that are fine
 * @param {RegExp[]} [o.skip]      hrefs never to open (sign out, …)
 * @param {RegExp[]} [o.expectedErrorScreens]  hrefs whose error state is expected on this stack
 * @param {string} o.tag           log prefix
 */
async function crawlPanel({ page, prefix, expectedApiErrors, expectedErrorScreens = [], skip = [], tag }) {
  const start = (await collectSidebar(page, prefix)).filter((l) => l.href && !skip.some((re) => re.test(l.href)));
  const queue = [...new Map(start.map((l) => [patternOf(l.href), { ...l, from: 'sidebar' }])).values()];
  const seen = new Set(queue.map((l) => patternOf(l.href)));
  const sidebarCount = queue.length;
  expect(sidebarCount).toBeGreaterThan(3);

  const problems = [];
  const visited = [];
  while (queue.length) {
    const { label, href, from } = queue.shift();
    const apiErrors = [];
    const pageErrors = [];
    const onResponse = (res) => {
      if (!res.url().startsWith(API) || res.status() < 400) return;
      const line = `${res.status()} ${res.url().slice(API.length).split('?')[0]}`;
      if (!expectedApiErrors.some((re) => re.test(line))) apiErrors.push(line);
    };
    const onPageError = (err) => pageErrors.push(err.message);
    page.on('response', onResponse);
    page.on('pageerror', onPageError);

    await page.goto(href);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const errorScreen = expectedErrorScreens.some((re) => re.test(href))
      ? 0
      : await page.locator(ERROR_SCREEN).count().catch(() => 0);

    page.off('response', onResponse);
    page.off('pageerror', onPageError);
    visited.push(patternOf(href));
    if (apiErrors.length || pageErrors.length || errorScreen) {
      problems.push({ label, href, from, apiErrors, pageErrors, errorScreen });
    }

    for (const link of await collectLinks(page, prefix)) {
      if (!link.href || skip.some((re) => re.test(link.href))) continue;
      const key = patternOf(link.href);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ ...link, from: href });
    }
  }

  console.log(`[${tag}] ${sidebarCount} sidebar modules, ${visited.length} screens in all, ${problems.length} with problems`);
  console.log(`[${tag}] screens: ${visited.join(' ')}`);
  for (const p of problems) console.log(`[${tag}] ${JSON.stringify(p)}`);
  return { problems, visited, sidebarCount };
}

module.exports = { crawlPanel };
