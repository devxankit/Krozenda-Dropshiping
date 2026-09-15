const { messaging, isFirebaseConfigured } = require('../Config/firebase');

// FCM's multicast call accepts at most 500 tokens per request.
const CHUNK_SIZE = 500;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

const STALE_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
  'messaging/invalid-registration-token',
]);

// Sends one push to every token, in batches. Best-effort per token — a few
// dead tokens (uninstalled app, revoked permission) never fail the whole
// send, they just get reported back so the caller can prune them.
async function sendToTokens(tokens, { title, body, data = {} } = {}) {
  if (!isFirebaseConfigured) {
    return { successCount: 0, failureCount: tokens.length, staleTokens: [] };
  }
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, staleTokens: [] };
  }

  let successCount = 0;
  let failureCount = 0;
  const staleTokens = [];

  for (const batch of chunk(tokens, CHUNK_SIZE)) {
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((result, index) => {
      if (!result.success && STALE_TOKEN_ERRORS.has(result.error?.code)) {
        staleTokens.push(batch[index]);
      }
    });
  }

  return { successCount, failureCount, staleTokens };
}

module.exports = { sendToTokens };
