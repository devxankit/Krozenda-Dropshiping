// Shared test setup: every page refuses to talk to anything but localhost,
// and the seed the isolated backend wrote (tokens, product ids) is readable.

const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');

const API = 'http://localhost:5056';
// The only two origins a test page may talk to: this stack's API and web
// server. Anything else — including another local server such as a dev
// backend on :5000 — is refused.
const ALLOWED_ORIGINS = new Set(['http://localhost:5056', 'http://localhost:5174']);
const FIXTURES_FILE = path.join(__dirname, '..', '..', 'backend', 'tests', 'performance', 'fixtures-e2e.json');

function seed() {
  return JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf8'));
}

const test = base.test.extend({
  page: async ({ page }, use) => {
    const blocked = [];
    await page.route('**/*', (route) => {
      const { origin } = new URL(route.request().url());
      if (ALLOWED_ORIGINS.has(origin)) return route.continue();
      blocked.push(origin);
      return route.abort();
    });
    // Surfaces uncaught page errors in the test output instead of hiding them.
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
    // Diagnostics: a failed request to our own stack, and the browser
    // declaring itself offline, are both things a flaky run needs explained.
    page.on('requestfailed', (req) => {
      if (ALLOWED_ORIGINS.has(new URL(req.url()).origin)) {
        console.log(`[requestfailed] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
      }
    });
    await page.addInitScript(() => {
      window.addEventListener('offline', () => console.log(`[browser] offline event, onLine=${navigator.onLine}`));
    });
    page.on('console', (msg) => {
      if (msg.text().startsWith('[browser]')) console.log(msg.text());
    });
    await use(page);
  },
});

// Signs a buyer in through the real OTP screens (dev OTP is fixed at 123456
// on the isolated backend). A fresh number each time = a fresh account.
function freshMobile() {
  return `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
}

module.exports = { test, expect: base.expect, API, seed, freshMobile };
