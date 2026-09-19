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

function applyPriceRounding(rawPrice, rounding = 'ROUND') {
  if (typeof rawPrice !== 'number' || !Number.isFinite(rawPrice) || rawPrice <= 0) {
    return 0;
  }
  if (rounding === 'ROUND') {
    return Math.round(rawPrice);
  }
  if (rounding === '9_ENDING') {
    const rounded = Math.round(rawPrice);
    if (rounded < 10) return rounded;
    return Math.floor(rounded / 10) * 10 + 9;
  }
  return Math.round(rawPrice * 100) / 100;
}

function calculateMarkupPrice(arg1, arg2 = 30, arg3 = 'ROUND') {
  let costInInr = 0;
  let markupPercent = 30;
  let rounding = 'ROUND';

  if (typeof arg1 === 'object' && arg1 !== null) {
    costInInr = arg1.costInInr;
    markupPercent = arg1.markupPercent !== undefined ? arg1.markupPercent : 30;
    rounding = arg1.rounding || 'ROUND';
  } else {
    costInInr = arg1;
    markupPercent = arg2;
    rounding = arg3;
  }

  const cost = Math.max(0, Number(costInInr) || 0);
  const percent = Math.max(0, Number(markupPercent) || 0);
  const rawPrice = cost + (cost * (percent / 100));
  return applyPriceRounding(rawPrice, rounding);
}

module.exports = {
  USD_TO_INR_RATE,
  usdToInr,
  parseCjPrice,
  applyPriceRounding,
  calculateMarkupPrice,
};
