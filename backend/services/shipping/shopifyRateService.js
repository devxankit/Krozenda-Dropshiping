const ShopifySettings = require('../../Models/ShopifySettings');

// Delivery charge for externally fulfilled lines.
//
// Pure arithmetic from admin-configured rules — NO network call. The provider
// ships these parcels, so no carrier can quote them, and asking one at
// checkout would add latency and a failure mode to the most important request
// in the application.
//
// It fails CLOSED. An unconfigured rule returns not-ok, which blocks the
// checkout, rather than returning zero. Free shipping that nobody chose is
// indistinguishable from working software right up until the month's numbers
// are added up.

const MODES = Object.freeze(['FLAT_PER_ORDER', 'PER_ITEM', 'FLAT_PLUS_PER_ITEM', 'FREE']);

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

/**
 * @param {object} args
 * @param {Array}  args.entries   cart entries for this fulfilment type
 * @param {number} args.subtotal  goods total after discount, for the free threshold
 * @returns {Promise<{ok: boolean, charge?: number, reason?: string, courierName?: string, estimatedDeliveryDays?: number}>}
 */
async function quoteShopifyGroup({ entries = [], subtotal = 0 } = {}) {
  const settings = await ShopifySettings.getSettings();
  const rules = settings.shippingRules || {};

  if (rules.configured !== true) {
    return { ok: false, reason: 'SHOPIFY_RATE_NOT_CONFIGURED' };
  }

  const mode = MODES.includes(rules.mode) ? rules.mode : null;
  if (!mode) return { ok: false, reason: 'SHOPIFY_RATE_MODE_INVALID' };

  const units = entries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
  if (units === 0) return { ok: false, reason: 'NO_ITEMS' };

  const flat = Math.max(0, Number(rules.flatAmount) || 0);
  const perItem = Math.max(0, Number(rules.perItemAmount) || 0);

  let charge;
  switch (mode) {
    case 'FREE':
      charge = 0;
      break;
    case 'PER_ITEM':
      charge = perItem * units;
      break;
    case 'FLAT_PLUS_PER_ITEM':
      charge = flat + perItem * units;
      break;
    case 'FLAT_PER_ORDER':
    default:
      charge = flat;
      break;
  }

  // The threshold is measured on what the buyer actually pays for the goods,
  // which is why the caller passes the post-discount subtotal.
  const freeAbove = Math.max(0, Number(rules.freeAboveCartValue) || 0);
  const qualifiesFree = freeAbove > 0 && Number(subtotal) >= freeAbove;
  if (qualifiesFree) charge = 0;

  return {
    ok: true,
    charge: round2(charge),
    courierName: rules.label || 'Supplier delivery',
    estimatedDeliveryDays: Math.max(1, Number(rules.estimatedDeliveryDays) || 7),
    freeApplied: qualifiesFree,
  };
}

module.exports = { quoteShopifyGroup, MODES };
