// CJ quotes every cost in USD; Krozenda sells in INR. This is the one place
// that conversion happens for the automatic pricing engine — before this
// fix, cjOnboardingService.computeSellingPrice added USD cost + USD shipping
// + an INR-denominated margin directly, silently pricing every
// automatically-priced product at roughly 1/87th of its real cost.
//
// This is a fixed, documented approximation, not a live forex rate — the
// admin can always override the resulting price by re-onboarding under
// MANUAL mode, or by editing the product directly afterward. A live-rate
// integration is future work, not a blocker: what matters here is that the
// unit is consistent (USD in, INR out), not that the rate is exactly today's.
const USD_TO_INR_RATE = Number(process.env.CJ_USD_TO_INR_RATE || 87);

function usdToInr(usdAmount) {
  return (usdAmount || 0) * USD_TO_INR_RATE;
}

// CJ sometimes quotes a price as a range string ("5.00-8.00") instead of a
// single number — a plain Number() on that is NaN, which silently poisons
// every downstream computation (selling price, margin, sync). This takes
// the low end of a range — the honest floor of what the product could cost
// — and returns 0 for anything unparseable, never NaN.
function parseCjPrice(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return 0;
  const match = raw.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

module.exports = { USD_TO_INR_RATE, usdToInr, parseCjPrice };
