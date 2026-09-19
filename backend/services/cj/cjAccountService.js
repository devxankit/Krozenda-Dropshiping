const { call } = require('./cjClient');
const cjAuthService = require('./cjAuthService');
const requestManager = require('./cjRequestManager');

// CJ account-level reads that don't belong to any single product/order —
// currently just balance (master plan §24's "CJ Balance" dashboard card).
// Same field-name caveat as the other CJ services: verify against a live
// sandbox account before production use.

const BALANCE_PATH = '/v1/authentication/getBalance';

function authenticatedCall(request) {
  return cjAuthService.withAuth((accessToken) =>
    requestManager.enqueue(() => call({ ...request, accessToken }))
  );
}

async function getBalance() {
  const { body } = await authenticatedCall({
    method: 'GET',
    path: BALANCE_PATH,
    idempotent: true,
  });

  const data = body?.data || {};
  return {
    balance: Number(data.amount ?? data.balance ?? 0) || 0,
    currency: data.currency || 'USD',
  };
}

module.exports = { getBalance };
