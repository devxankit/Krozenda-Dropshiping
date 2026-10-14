// Which dropshipping app put a product on the Shopify store.
//
// WHY THIS IS NEEDED AT ALL. Several dropshipping apps can feed one Shopify
// store, and Krozenda reads the store, not the apps — which is the whole
// reason this integration goes through Shopify. But when an order sticks, or
// margin has to be reported per supplier, "it came from Shopify" is not an
// answer anybody can act on.
//
// HOW IT IS DETECTED, in the order the live store actually supports:
//
//   1. SKU prefix. Every app stamps its own product ids into the SKU, and on
//      the live store this separates them perfectly: VFPD… vs DS….
//   2. Vendor. Checked only against known names, because it is NOT reliable:
//      vFulfill writes the store's own name ("My Store") and Dropship India
//      writes bare numeric supplier ids ("18052"). Neither can be trusted as
//      a general rule, so vendor is a hint and never the first answer.
//
// Unknown is a real answer and is returned as such. Guessing a supplier is
// worse than admitting we cannot tell: it would attribute one app's costs and
// failures to another.

const UNKNOWN = 'UNKNOWN';

const SUPPLIERS = Object.freeze({
  VFULFILL: {
    code: 'VFULFILL',
    label: 'vFulfill',
    skuPrefixes: ['VFPD', 'VF'],
    vendorNames: [],
  },
  DROPSHIP_INDIA: {
    code: 'DROPSHIP_INDIA',
    label: 'Dropship India',
    // `DS` must be tested after longer prefixes, or it would swallow anything
    // else beginning with those two letters. Ordering is handled below.
    skuPrefixes: ['DSI', 'DS'],
    vendorNames: [],
  },
});

const SUPPLIER_CODES = Object.freeze([...Object.keys(SUPPLIERS), UNKNOWN]);

// Longest prefix first, so a specific rule always beats a general one.
const PREFIX_RULES = Object.values(SUPPLIERS)
  .flatMap((s) => s.skuPrefixes.map((prefix) => ({ prefix: prefix.toUpperCase(), code: s.code })))
  .sort((a, b) => b.prefix.length - a.prefix.length);

function fromSku(sku) {
  const value = String(sku || '').trim().toUpperCase();
  if (!value) return null;
  const hit = PREFIX_RULES.find((rule) => value.startsWith(rule.prefix));
  return hit ? hit.code : null;
}

function fromVendor(vendor) {
  const value = String(vendor || '').trim().toLowerCase();
  if (!value) return null;
  for (const supplier of Object.values(SUPPLIERS)) {
    if (supplier.vendorNames.some((name) => value === name.toLowerCase())) return supplier.code;
  }
  return null;
}

/**
 * @param {object} shopifyProduct a product as the catalogue service returns it
 * @returns {{code: string, label: string, confidence: 'SKU'|'VENDOR'|'NONE'}}
 */
function resolveSupplier(shopifyProduct) {
  const variants = shopifyProduct?.variants?.nodes || [];

  // Every variant, not just the first: one blank SKU should not make a whole
  // product unattributable when its siblings are stamped.
  for (const variant of variants) {
    const code = fromSku(variant?.sku);
    if (code) return { code, label: SUPPLIERS[code].label, confidence: 'SKU' };
  }

  const byVendor = fromVendor(shopifyProduct?.vendor);
  if (byVendor) return { code: byVendor, label: SUPPLIERS[byVendor].label, confidence: 'VENDOR' };

  return { code: UNKNOWN, label: 'Unknown supplier', confidence: 'NONE' };
}

function labelOf(code) {
  return SUPPLIERS[code]?.label || 'Unknown supplier';
}

module.exports = { resolveSupplier, labelOf, SUPPLIERS, SUPPLIER_CODES, UNKNOWN };
