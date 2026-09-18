const bwipjs = require('bwip-js');
const Counter = require('../Models/Counter');

// Product barcodes: real, standards-compliant EAN-13 — the format every
// retail barcode scanner (a dedicated USB/Bluetooth gun, or a phone's camera
// app) already knows how to read, so nothing extra needs to be installed on a
// warehouse device to use these.
//
// EAN-13 = 12 digits chosen by the issuer + 1 checksum digit computed from
// them. A real retail barcode's first few digits are a GS1-issued company
// prefix; this marketplace has not registered one (that costs money and is a
// business decision, not an engineering one), so every code here starts with
// "20" — the "20–29" prefix range GS1 reserves specifically for internal,
// in-store use, exactly this situation. The result is a barcode that is
// STRUCTURALLY VALID (any scanner reads it, and the checksum is correct) but
// guaranteed to never collide with a real product's retail barcode.
const INTERNAL_PREFIX = '20';
const SEQUENCE_LENGTH = 12 - INTERNAL_PREFIX.length; // 10 digits
const COUNTER_KEY = 'product_barcode';

// Standard EAN-13 checksum: from the left, odd positions (1st, 3rd, ...)
// weight 1, even positions weight 3; the check digit is whatever brings the
// weighted sum to the next multiple of 10.
function ean13CheckDigit(twelveDigits) {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(twelveDigits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

// Reserves the next sequence number and returns a fresh, valid EAN-13.
// Sequential (not random) so two barcodes are never even accidentally equal,
// and so a warehouse can tell at a glance which of two prints is newer.
async function generateBarcode() {
  const sequence = await Counter.next(COUNTER_KEY);
  const base = INTERNAL_PREFIX + String(sequence).padStart(SEQUENCE_LENGTH, '0');
  if (base.length !== 12) {
    // Ten digits is ~10 billion products — this is a sanity guard, not an
    // expected path.
    throw new Error('Product barcode sequence exhausted');
  }
  return base + ean13CheckDigit(base);
}

// True EAN-13 shape: 13 digits, and the checksum actually matches. Used to
// validate a code typed or scanned in from outside (a lookup) before it ever
// reaches a database query.
function isValidEan13(code) {
  if (!/^\d{13}$/.test(code || '')) return false;
  return ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

// Renders the scannable barcode image for one code. PNG, because it prints
// crisply on a label printer and every browser and image tool opens it with
// no extra library. `scale`/`height` are tuned for a small on-screen preview
// and a standard adhesive label alike — good enough for both without a
// second code path.
async function renderBarcodePng(code) {
  return bwipjs.toBuffer({
    bcid: 'ean13',
    text: code,
    scale: 3,
    height: 15,
    includetext: true,
  });
}

module.exports = { generateBarcode, isValidEan13, renderBarcodePng, ean13CheckDigit };
