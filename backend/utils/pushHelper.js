const { messaging, isFirebaseConfigured } = require('../Config/firebase');
const { webpushLink } = require('./notificationLinks');

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
  // Issued by a different Firebase project (an old app build or config) —
  // this project can never deliver to it.
  'messaging/mismatched-credential',
]);

// Sends one push to every token, in batches. Best-effort per token — a few
// dead tokens (uninstalled app, revoked permission) never fail the whole
// send, they just get reported back so the caller can prune them.
//
// `link` is an app path (/app/orders/..). It rides in `data.link` for the
// service worker and the foreground handlers, and — when FRONTEND_URL is https
// — as webpush.fcmOptions.link, which is what makes a tap on the browser's
// own notification open the right page.
async function sendToTokens(tokens, { title, body, data = {}, link = null } = {}) {
  if (!isFirebaseConfigured) {
    return { successCount: 0, failureCount: tokens.length, staleTokens: [] };
  }
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, staleTokens: [] };
  }

  const payloadData = { ...data };
  if (link) payloadData.link = link;
  const absoluteLink = link ? webpushLink(link) : null;
  const webpush = { notification: { icon: '/images/logo.png' } };
  if (absoluteLink) webpush.fcmOptions = { link: absoluteLink };

  let successCount = 0;
  let failureCount = 0;
  const staleTokens = [];

  for (const batch of chunk(tokens, CHUNK_SIZE)) {
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(payloadData).map(([key, value]) => [key, String(value)])),
      webpush,
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
