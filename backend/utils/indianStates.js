// Indian state names -> ISO 3166-2 subdivision codes.
//
// Shopify's MailingAddressInput takes `provinceCode`, not a province name.
// Krozenda stores what the buyer typed or picked ("Maharashtra", "TN",
// "Tamil Nadu"), so the two have to be reconciled before an address can be
// sent — and an address Shopify rejects is an order the supplier never sees.
//
// A name that cannot be matched returns null, and the caller sends the address
// WITHOUT a province code rather than with a wrong one. A wrong state routes a
// parcel to the wrong end of the country; a missing one is corrected by the
// PIN code, which is also on the address.

const STATES = Object.freeze({
  'andhra pradesh': 'AP',
  'arunachal pradesh': 'AR',
  assam: 'AS',
  bihar: 'BR',
  chhattisgarh: 'CG',
  chattisgarh: 'CG',
  goa: 'GA',
  gujarat: 'GJ',
  haryana: 'HR',
  'himachal pradesh': 'HP',
  jharkhand: 'JH',
  karnataka: 'KA',
  kerala: 'KL',
  'madhya pradesh': 'MP',
  maharashtra: 'MH',
  manipur: 'MN',
  meghalaya: 'ML',
  mizoram: 'MZ',
  nagaland: 'NL',
  odisha: 'OR',
  orissa: 'OR',
  punjab: 'PB',
  rajasthan: 'RJ',
  sikkim: 'SK',
  'tamil nadu': 'TN',
  tamilnadu: 'TN',
  telangana: 'TS',
  tripura: 'TR',
  'uttar pradesh': 'UP',
  uttarakhand: 'UK',
  uttaranchal: 'UK',
  'west bengal': 'WB',

  // Union territories.
  'andaman and nicobar islands': 'AN',
  'andaman & nicobar islands': 'AN',
  chandigarh: 'CH',
  'dadra and nagar haveli and daman and diu': 'DH',
  'dadra and nagar haveli': 'DH',
  'daman and diu': 'DH',
  delhi: 'DL',
  'new delhi': 'DL',
  'nct of delhi': 'DL',
  'jammu and kashmir': 'JK',
  'jammu & kashmir': 'JK',
  ladakh: 'LA',
  lakshadweep: 'LD',
  puducherry: 'PY',
  pondicherry: 'PY',
});

const CODES = new Set(Object.values(STATES));

/**
 * @param {string} state a state name, or an already-valid code
 * @returns {string|null} the ISO code, or null when it cannot be determined
 */
function toProvinceCode(state) {
  const raw = String(state || '').trim();
  if (!raw) return null;

  // Already a code.
  const upper = raw.toUpperCase();
  if (CODES.has(upper)) return upper;

  const key = raw
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return STATES[key] || null;
}

module.exports = { toProvinceCode, STATES };
