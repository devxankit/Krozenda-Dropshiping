// GST state codes — the first two digits of every GSTIN, and what decides
// whether a supply is intra-state (CGST + SGST) or inter-state (IGST).

const STATE_CODES = Object.freeze({
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  10: 'Bihar',
  11: 'Sikkim',
  12: 'Arunachal Pradesh',
  13: 'Nagaland',
  14: 'Manipur',
  15: 'Mizoram',
  16: 'Tripura',
  17: 'Meghalaya',
  18: 'Assam',
  19: 'West Bengal',
  20: 'Jharkhand',
  21: 'Odisha',
  22: 'Chhattisgarh',
  23: 'Madhya Pradesh',
  24: 'Gujarat',
  26: 'Dadra and Nagar Haveli and Daman and Diu',
  27: 'Maharashtra',
  29: 'Karnataka',
  30: 'Goa',
  31: 'Lakshadweep',
  32: 'Kerala',
  33: 'Tamil Nadu',
  34: 'Puducherry',
  35: 'Andaman and Nicobar Islands',
  36: 'Telangana',
  37: 'Andhra Pradesh',
  38: 'Ladakh',
});

// Spellings people actually type into an address form.
const ALIASES = Object.freeze({
  orissa: '21',
  pondicherry: '34',
  'jammu & kashmir': '01',
  'andaman & nicobar': '35',
  'andaman & nicobar islands': '35',
  'andaman and nicobar': '35',
  'nct of delhi': '07',
  'new delhi': '07',
  'daman and diu': '26',
  'dadra and nagar haveli': '26',
  'dadra & nagar haveli and daman & diu': '26',
  uttaranchal: '05',
});

const BY_NAME = new Map(
  Object.entries(STATE_CODES).map(([code, name]) => [name.toLowerCase(), String(code).padStart(2, '0')])
);

function normalise(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// '27' for 'Maharashtra' / 'maharashtra ' / 'MAHARASHTRA'; null when unknown.
function stateCodeFromName(name) {
  const key = normalise(name);
  if (!key) return null;
  return BY_NAME.get(key) || ALIASES[key] || BY_NAME.get(key.replace(/&/g, 'and')) || null;
}

// A GSTIN is 15 characters and starts with its state code.
function stateCodeFromGstin(gstin) {
  const code = String(gstin || '').trim().slice(0, 2);
  return /^\d{2}$/.test(code) && (STATE_CODES[code] || STATE_CODES[Number(code)]) ? code : null;
}

function stateName(code) {
  if (!code) return '';
  return STATE_CODES[code] || STATE_CODES[Number(code)] || '';
}

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function isValidGstin(gstin) {
  return GSTIN_PATTERN.test(String(gstin || '').trim().toUpperCase());
}

module.exports = { STATE_CODES, stateCodeFromName, stateCodeFromGstin, stateName, isValidGstin };
