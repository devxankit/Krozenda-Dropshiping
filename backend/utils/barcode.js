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

// Renders the label's barcode: a classic 1D Code 128 of the product's SKU —
// plain vertical bars, which every scanner (a laser gun included) reads, and
// which types the SKU into the panel's "Scan barcode" box (the lookup there
// accepts the SKU as well as the EAN-13 number). The product's full details
// are carried by the QR code beside it: a 1D barcode of those ~140
// characters would be ~37 cm wide.
//
// Falls back to the product's EAN-13 number when it has no SKU, or one that
// Code 128 cannot encode (non-ASCII).
function barcodeText(product) {
  const sku = String(product.sku || '').trim();
  return sku && /^[\x20-\x7E]+$/.test(sku) ? sku : product.barcode;
}

async function renderBarcodePng(product) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: barcodeText(product),
    // 2px modules: shown at its natural size (the label does not shrink it),
    // this reads on a phone from a screen — checked with a ZXing decoder.
    scale: 2,
    height: 16,
    includetext: true,
    textxalign: 'center',
    textsize: 11,
    // Keeps the printed SKU clear of the bars.
    textyoffset: -6,
    // White background and quiet zone: scanners need the margin, and a
    // transparent PNG shows black on black in a dark-mode viewer.
    backgroundcolor: 'FFFFFF',
    paddingwidth: 12,
    paddingheight: 10,
  });
}

// The product's details as one line of text, for the QR code: a phone camera
// or a 2D scanner shows them with no login and no app.
//
// One line, barcode FIRST: a 2D scanner types it into the panel's scan box
// like a keyboard and would submit at the first newline, and the scan box
// picks the 13-digit code out of the front of it.
function productQrText(product) {
  const price = product.salePrice != null && product.salePrice < product.price ? product.salePrice : product.price;
  const parts = [
    product.barcode,
    product.name,
    product.sku ? `SKU: ${product.sku}` : null,
    price != null ? `Price: Rs.${price}` : null,
    product.mrp != null && product.mrp > price ? `MRP: Rs.${product.mrp}` : null,
    product.brand?.name ? `Brand: ${product.brand.name}` : null,
    product.category?.name ? `Category: ${product.category.name}` : null,
  ];
  return parts.filter(Boolean).join(' | ');
}

async function renderProductQrPng(product) {
  return bwipjs.toBuffer({
    bcid: 'qrcode',
    // bwip-js reads the string one byte per character, so a product name in
    // Hindi (or with a ₹) has to be handed over as its UTF-8 bytes; phone
    // scanners decode those back as UTF-8.
    text: Buffer.from(productQrText(product), 'utf8').toString('latin1'),
    eclevel: 'M',
    scale: 4,
    backgroundcolor: 'FFFFFF',
    paddingwidth: 4,
    paddingheight: 4,
  });
}

module.exports = {
  generateBarcode,
  isValidEan13,
  renderBarcodePng,
  renderProductQrPng,
  productQrText,
  barcodeText,
  ean13CheckDigit,
};
