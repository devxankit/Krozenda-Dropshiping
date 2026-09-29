// Screen-level steps shared by the journeys. Locators are the ones a user
// perceives (roles and labels), so a markup refactor doesn't break them but
// a changed label on screen does.

const { expect, API, freshMobile } = require('./fixtures');

async function loginAsBuyer(page, mobile = freshMobile()) {
  await page.goto('/auth/login');
  await page.locator('#mobile-input').fill(mobile);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Get Verification Code/i }).click();
  await page.locator('#otp-box-0').waitFor();
  // The sixth digit submits on its own.
  for (let i = 0; i < 6; i += 1) await page.locator(`#otp-box-${i}`).fill(String(i + 1));
  await page.getByRole('button', { name: /Continue to Marketplace/i }).click();
  await expect(page).toHaveURL(/\/app\//);
  return mobile;
}

async function addProductToCart(page, productId) {
  await page.goto(`/app/product/${productId}`);
  const add = page.getByRole('button', { name: /add to cart/i }).first();
  await add.click();
  // Adding turns the button into a quantity stepper — the confirmation both
  // the desktop and the mobile layout show (mobile has no cart badge here).
  await expect(page.getByRole('button', { name: 'Increase quantity' }).first()).toBeVisible();
}

async function addAddressAtCheckout(page, address = {}) {
  const a = {
    name: 'E2E Buyer',
    phone: '9876543210',
    line1: '12 Test Street',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    ...address,
  };
  // "Add New Address" on desktop, "Add New" on mobile.
  await page.getByRole('button', { name: /^\s*Add New( Address)?\s*$/ }).click();
  await page.getByRole('textbox', { name: 'Full Name *' }).fill(a.name);
  await page.getByRole('textbox', { name: 'Phone Number *' }).fill(a.phone);
  await page.getByRole('textbox', { name: 'Address Line 1 *' }).fill(a.line1);
  await page.getByRole('textbox', { name: 'City *' }).fill(a.city);
  await page.getByRole('button', { name: 'Select State' }).click();
  await page.getByText(a.state, { exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Pincode *' }).fill(a.pincode);
  await page.getByRole('button', { name: 'Save Address' }).click();
  await expect(page.getByText(`${a.line1}, ${a.city}, ${a.state} - ${a.pincode}`).first()).toBeVisible();
}

async function apiGet(request, path, token) {
  const res = await request.get(`${API}${path}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  return { status: res.status(), body: await res.json() };
}

// The ₹ figure next to "Total Amount Payable" on the order summary.
async function summaryTotal(page) {
  const text = await page.getByText('Total Amount Payable').locator('..').innerText();
  return text.match(/₹[\d,]+(\.\d+)?/)[0];
}

module.exports = { summaryTotal, loginAsBuyer, addProductToCart, addAddressAtCheckout, apiGet };
