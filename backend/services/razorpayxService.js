const crypto = require('crypto');

// RazorpayX Payouts client: seller contacts, their bank fund accounts, and
// payouts from the platform's RazorpayX account to those bank accounts.
//
// The installed `razorpay` SDK has no RazorpayX resources, so this talks to
// the REST API directly. Endpoints and fields per Razorpay's API reference:
//   POST  /v1/contacts                 name (3–50 chars), type, reference_id
//   POST  /v1/fund_accounts            contact_id, account_type bank_account
//   PATCH /v1/fund_accounts/:id        { active: false } — retire an old account
//   POST  /v1/payouts                  X-Payout-Idempotency (UUID) mandatory
//   GET   /v1/payouts/:id
//
// Both create calls return the existing record when every field matches, and
// the payout call is idempotent on its UUID, so all of these are safe to
// repeat.

const BASE_URL = 'https://api.razorpay.com/v1';

// IMPS carries up to ₹5,00,000 and settles in minutes; above that, NEFT.
const IMPS_LIMIT_PAISE = 5_00_000 * 100;

// Which rail seller settlements go out on:
//   razorpayx (default) — bank payouts from the platform's RazorpayX account.
//                         Needs no Razorpay approval beyond RazorpayX itself.
//   route               — Razorpay Route transfers (needs Route enabled,
//                         which RBI rules tie to ₹40L+ turnover).
function payoutProvider() {
  return String(process.env.SELLER_PAYOUT_PROVIDER || '').toLowerCase() === 'route' ? 'route' : 'razorpayx';
}

// The platform's RazorpayX account the money is paid from (the Current
// Account number, or the RazorpayX Lite account number, from the RazorpayX
// dashboard). Without it no payout can be made.
function sourceAccountNumber() {
  return String(process.env.RAZORPAYX_ACCOUNT_NUMBER || '').trim();
}

function isConfigured() {
  return Boolean(sourceAccountNumber() && credentials().keyId && credentials().keySecret);
}

// RazorpayX uses the account's API keys; separate keys can be given if the
// RazorpayX account is a different merchant from the payment gateway.
function credentials() {
  return {
    keyId: process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '',
  };
}

async function request(method, path, { body, headers = {} } = {}) {
  const { keyId, keySecret } = credentials();
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    // Network failure: nothing is known about whether RazorpayX acted.
    const wrapped = new Error(`RazorpayX request failed: ${err.message}`);
    wrapped.statusCode = null;
    throw wrapped;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error?.description || `RazorpayX ${method} ${path} returned ${response.status}`);
    err.statusCode = response.status;
    err.error = data?.error || null;
    throw err;
  }
  return data;
}

/**
 * True when a failed call may still have taken effect, or may succeed if
 * simply repeated: no response at all, a rate limit, or a server error. A
 * 4xx is RazorpayX refusing the request — repeating it changes nothing.
 */
function isRetryable(err) {
  return !err?.statusCode || err.statusCode === 429 || err.statusCode >= 500;
}

function errorText(err) {
  return err?.error?.description || err?.message || String(err);
}

// RazorpayX names: letters, digits, space and ' - _ / ( ) . only, and not
// ending in a special character other than a full stop.
function cleanName(value, { min = 3, max = 50 } = {}) {
  let name = String(value || '')
    .replace(/[^a-zA-Z0-9 '\-_/().]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  name = name.replace(/[ '\-_/()]+$/, '');
  if (name.length < min) name = `${name} Seller`.trim().slice(0, max);
  return name;
}

function normalizeAccountNumber(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '');
}

function normalizeIfsc(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * A fingerprint of the bank account a fund account was made for, so a
 * changed bank account is noticed and gets a fresh fund account.
 */
function bankKey(bank = {}) {
  return `${normalizeAccountNumber(bank.accountNumber)}|${normalizeIfsc(bank.ifsc)}`;
}

async function createContact({ name, email, contact, referenceId, notes = {} }) {
  return request('POST', '/contacts', {
    body: {
      name: cleanName(name),
      ...(email ? { email } : {}),
      ...(contact ? { contact } : {}),
      type: 'vendor',
      reference_id: String(referenceId).slice(0, 40),
      notes,
    },
  });
}

async function createBankFundAccount({ contactId, name, ifsc, accountNumber }) {
  return request('POST', '/fund_accounts', {
    body: {
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: {
        name: cleanName(name, { max: 120 }),
        ifsc: normalizeIfsc(ifsc),
        account_number: normalizeAccountNumber(accountNumber),
      },
    },
  });
}

async function deactivateFundAccount(fundAccountId) {
  return request('PATCH', `/fund_accounts/${fundAccountId}`, { body: { active: false } });
}

function payoutMode(amountPaise) {
  const configured = String(process.env.RAZORPAYX_PAYOUT_MODE || '').toUpperCase();
  if (['IMPS', 'NEFT', 'RTGS'].includes(configured)) return configured;
  return amountPaise <= IMPS_LIMIT_PAISE ? 'IMPS' : 'NEFT';
}

/**
 * Pay `amountPaise` to a seller's fund account. `idempotencyKey` must be a
 * UUID fixed for this payout attempt — see Payout.providerIdempotencyKey.
 * queue_if_low_balance: a payout made while the RazorpayX balance is short
 * waits in `queued` until it is topped up, instead of failing.
 */
async function createPayout({ fundAccountId, amountPaise, referenceId, narration, notes = {}, idempotencyKey }) {
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new Error('amountPaise must be an integer of at least 100 (₹1)');
  }
  if (!idempotencyKey) throw new Error('idempotencyKey is required');

  return request('POST', '/payouts', {
    headers: { 'X-Payout-Idempotency': idempotencyKey },
    body: {
      account_number: sourceAccountNumber(),
      fund_account_id: fundAccountId,
      amount: amountPaise,
      currency: 'INR',
      mode: payoutMode(amountPaise),
      purpose: 'vendor bill',
      queue_if_low_balance: true,
      reference_id: String(referenceId).slice(0, 40),
      narration: String(narration || '').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30),
      notes,
    },
  });
}

async function fetchPayout(payoutId) {
  return request('GET', `/payouts/${payoutId}`);
}

function newIdempotencyKey() {
  return crypto.randomUUID();
}

module.exports = {
  payoutProvider,
  sourceAccountNumber,
  isConfigured,
  createContact,
  createBankFundAccount,
  deactivateFundAccount,
  createPayout,
  fetchPayout,
  payoutMode,
  bankKey,
  cleanName,
  isRetryable,
  errorText,
  newIdempotencyKey,
  IMPS_LIMIT_PAISE,
};
