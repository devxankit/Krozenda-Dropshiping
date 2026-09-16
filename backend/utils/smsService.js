// SMS India Hub (cloud.smsindiahub.in) transactional SMS gateway — used only
// to deliver the login/registration OTP. Only ever called in production;
// dev/staging always uses a fixed OTP (see userAuthController.requestOtp) so
// nobody needs a live SMS account to test locally.
//
// Endpoint/param shape (pushsms.aspx, not api/mt/SendSMS) is verified
// working: a live send on the account behind SMS_INDIA_HUB_API_KEY returned
// ErrorCode 000 and decremented the transactional balance by 1.
//
// STOPGAP — read before touching this file: the working SenderId/Entity/
// Template combo below was registered with "Mynzo" as the brand text, not
// "Krozenda". Sending real Krozenda OTPs under someone else's brand name is
// a stopgap, not a destination — the correct fix is registering Krozenda's
// own DLT template under its own entity and swapping the env vars + message
// text below once that's approved.
const SMS_API_URL = 'https://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
const BALANCE_API_URL = 'https://cloud.smsindiahub.in/vendorsms/CheckBalance.aspx';

// TRAI DLT compliance note: the message body must match the DLT-registered
// template EXACTLY (only the ##var## slot may change) or the gateway
// rejects it with ErrorCode 006 "Invalid template text" — so this is the
// one and only place the OTP template text lives. The brand word is
// hard-coded (not read from APP_NAME) because it must match whatever brand
// SMS_INDIA_HUB_ENTITY_ID/TEMPLATE_ID were actually registered under — see
// the STOPGAP note above. Don't change this string without updating the
// registered template first.
function buildOtpMessage(otp) {
  return `Welcome to the Krozenda powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`;
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// The gateway returns HTTP 200 even on a rejected send — you must read the
// body. Some responses are plain text ("Success#...") rather than JSON.
function parseGatewayResponse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function isSuccess(data, rawText) {
  if (data && data.ErrorCode !== undefined) return String(data.ErrorCode) === '000';
  return /^success/i.test(rawText || '') || /submitted successfully/i.test(rawText || '');
}

// Sends the registration/login OTP over SMS. Throws if the gateway isn't
// configured or rejects the send — callers must treat that as a hard
// failure (the OTP was never delivered), not something to swallow.
async function sendOtpSms(mobileNumber, otp) {
  const apiKey = process.env.SMS_INDIA_HUB_API_KEY;
  const senderId = process.env.SMS_INDIA_HUB_SENDER_ID;
  const entityId = process.env.SMS_INDIA_HUB_ENTITY_ID;
  const templateId = process.env.SMS_INDIA_HUB_TEMPLATE_ID;

  if (!apiKey || !senderId || !entityId || !templateId) {
    throw new Error('SMS gateway is not configured (missing SMS_INDIA_HUB_* env vars)');
  }

  const msisdn = `91${mobileNumber}`;
  if (!/^91[6-9]\d{9}$/.test(msisdn)) {
    throw new Error(`Invalid destination number: ${mobileNumber}`);
  }

  const message = buildOtpMessage(otp);
  const params = new URLSearchParams({
    APIKey: apiKey,
    msisdn,
    sid: senderId,
    msg: message,
    fl: '0',
    gwid: '2', // transactional gateway — this account's promotional balance is near zero
    EntityId: entityId,
    dlttemplateid: templateId,
  });

  console.log(`[smsService] Sending OTP to ${msisdn}: "${message}"`);

  let response;
  try {
    response = await fetchWithTimeout(`${SMS_API_URL}?${params.toString()}`);
  } catch (err) {
    throw new Error(`Could not reach the SMS gateway: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`SMS gateway returned HTTP ${response.status}`);
  }

  const rawText = (await response.text()).trim();
  const data = parseGatewayResponse(rawText);

  // Logged in full either way (minus the API key, which never appears in
  // the response) — success or rejection, the raw gateway response is the
  // fastest way to diagnose the next issue without reproducing it.
  if (isSuccess(data, rawText)) {
    console.log(`[smsService] Gateway accepted the send. Raw response:`, rawText);
  } else {
    console.error('[smsService] Gateway rejected the send. Raw response:', rawText);
    throw new Error(`SMS gateway rejected the OTP: ${data?.ErrorMessage || rawText || 'unknown error'}`);
  }

  return data || { raw: rawText };
}

// Read-only diagnostic — costs nothing, sends nothing. Useful for confirming
// the API key itself is live without spending an SMS credit.
async function checkSmsBalance() {
  const apiKey = process.env.SMS_INDIA_HUB_API_KEY;
  if (!apiKey) throw new Error('SMS gateway is not configured (missing SMS_INDIA_HUB_API_KEY)');

  const response = await fetchWithTimeout(`${BALANCE_API_URL}?APIKey=${encodeURIComponent(apiKey)}`);
  return (await response.text()).trim();
}

module.exports = { sendOtpSms, checkSmsBalance };
