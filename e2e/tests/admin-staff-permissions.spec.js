// A sub-admin in a real browser: the super-admin creates a role that only
// covers support tickets and a staff member holding it (API); the staff
// member signs in to the admin panel. The sidebar must offer only what the
// role covers, and opening a money/settings screen by URL must not load its
// data (the API answers 403 — QA-001).

const { test, expect, API, seed } = require('./fixtures');

test('support-only staff see support and cannot load coupons, settings or accounts', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'admin panel is a desktop screen');
  const admin = { Authorization: `Bearer ${seed().adminToken}` };
  const stamp = Date.now();
  const role = await request.post(`${API}/admin/roles`, {
    headers: admin,
    data: { name: `E2E Support ${stamp}`, permissions: ['admin.access', 'admin.people.support'] },
  });
  expect(role.status()).toBe(201);
  const roleId = (await role.json()).data.id || (await role.json()).data._id;
  const email = `e2e.support.${stamp}@test.local`;
  const staff = await request.post(`${API}/admin/staff`, {
    headers: admin,
    multipart: { name: 'E2E Support Agent', email, password: 'Support@12345', roleId: String(roleId), isActive: 'true' },
  });
  expect(staff.status()).toBe(201);

  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Work email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('Support@12345');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/admin\/(?!login)/);

  // The sidebar offers support, and none of the money or settings modules.
  await expect(page.getByRole('link', { name: 'Support tickets' }).first()).toBeVisible();
  for (const label of ['Coupons & offers', 'Settings', 'Ledger', 'Roles', 'Backups']) {
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  }

  // Typing the URL does not get the data either.
  for (const [screen, apiPath] of [
    ['/admin/marketing/coupons', '/admin/marketing/coupons'],
    ['/admin/settings/general', '/admin/settings/general'],
    ['/admin/accounts/ledger', '/admin/accounts/ledger'],
  ]) {
    const answered = page.waitForResponse((res) => res.url().startsWith(`${API}${apiPath}`), { timeout: 15000 }).catch(() => null);
    await page.goto(screen);
    const res = await answered;
    // Either the screen does not ask at all, or the API refuses it.
    if (res) expect(res.status()).toBe(403);
  }
});
